from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Annotated

from cofy.api import hash_key
from cofy.api.errors import NotAuthenticatedError
from fastapi import Depends, FastAPI, Request
from fastapi.security import APIKeyHeader

from ..persitance.grants import GrantsPersistence
from ..persitance.users import UsersPersistence
from .access import (
    GLOBAL_ROLE_PERMISSIONS,
    ROLE_PERMISSIONS,
    Action,
    ClientRecord,
    GlobalRole,
    Grant,
    Identity,
    Permission,
    Role,
    Subject,
    UserRecord,
)
from .host_tokens import host_tokens
from .session import current_identity


class Principal(ABC):
    """Whoever makes a request - a person logged in, or a client with an API key - and what they may do."""

    @property
    @abstractmethod
    def grants(self) -> Mapping[str, Role]:
        """The role they have in each community, by slug."""

    @property
    @abstractmethod
    def roles(self) -> list[GlobalRole]:
        """The roles they have outside any one community."""

    @property
    def system_admin(self) -> bool:
        return False

    @abstractmethod
    def grant_as_creator(self, grants: GrantsPersistence, slug: str) -> None:
        """Give them the role they get in community *slug*, which they just created."""

    def role_in(self, slug: str) -> Role | None:
        return self.grants.get(slug)

    def permissions(self, slug: str | None) -> frozenset[Permission]:
        """What they may do in community *slug*, or outside any one community when it is `None`: what their global
        roles let them."""
        if self.system_admin:
            return frozenset(Permission.all())
        if slug is None:
            return frozenset().union(*(GLOBAL_ROLE_PERMISSIONS[role] for role in self.roles))
        role = self.role_in(slug)
        return ROLE_PERMISSIONS[role] if role is not None else frozenset()

    def communities(self) -> list[str]:
        """The communities they have a role in."""
        return list(self.grants)

    def can(self, action: Action, subject: Subject, slug: str | None) -> bool:
        return Permission(action=action, subject=subject) in self.permissions(slug)


class User(Principal):
    """A person logged in."""

    def __init__(self, identity: Identity, record: UserRecord | None):
        self.identity = identity
        self.record = record

    @property
    def grants(self) -> Mapping[str, Role]:
        return self.record.grants if self.record is not None else {}

    @property
    def roles(self) -> list[GlobalRole]:
        return self.record.roles if self.record is not None else []

    @property
    def system_admin(self) -> bool:
        return self.record is not None and self.record.system_admin

    def grant_as_creator(self, grants: GrantsPersistence, slug: str) -> None:
        # A system admin may do anything already, and someone not listed can't create one.
        if self.record is not None and not self.system_admin:
            grants.create(slug, Grant(email=self.record.email, role=Role.community_admin))


class Client(Principal):
    """A program, known by the API key it sent."""

    def __init__(self, record: ClientRecord):
        self.record = record

    @property
    def name(self) -> str:
        return self.record.name

    @property
    def grants(self) -> Mapping[str, Role]:
        return self.record.grants

    @property
    def roles(self) -> list[GlobalRole]:
        return self.record.roles

    def grant_as_creator(self, grants: GrantsPersistence, slug: str) -> None:
        # To look after it, for whoever it created it for.
        grants.grant_client(slug, self.name, Role.integration)


def install_users(app: FastAPI, users: UsersPersistence) -> None:
    """Have *app* look up who may do what in *users*."""
    app.state.users = users


def _users(request: Request) -> UsersPersistence:
    return request.app.state.users


_authorization = APIKeyHeader(name="Authorization", auto_error=False, scheme_name="client")


def current_principal(request: Request, authorization: Annotated[str | None, Depends(_authorization)]) -> Principal:
    """Who makes this request: the client whose API key it carries, the person whose access token from an app
    embedding the console it carries, or else the person logged in.

    A token that doesn't hold is refused, even with a login beside it, so whoever sent it knows to get a fresh one.
    """
    if authorization is None:
        identity = current_identity(request)
        return User(identity, _users(request).match(identity))
    scheme, _, key = authorization.partition(" ")
    if scheme.lower() != "bearer" or not key:
        raise NotAuthenticatedError("Invalid token format")
    # Looked up by hash, which an attacker can't steer, so the lookup's timing reveals nothing of the stored keys.
    record = _users(request).client(hash_key(key))
    if record is not None:
        return Client(record)
    tokens = host_tokens(request)
    if tokens is None:
        raise NotAuthenticatedError("Invalid token")
    identity = tokens.identity(key)
    return User(identity, _users(request).match(identity))
