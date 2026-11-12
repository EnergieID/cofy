"""Who may do what in the management API: the permissions there are, the roles carrying them, and the people and
clients they are granted to."""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Annotated, Any

from cofy.api.secret import NAME_PATTERN
from cofy.api.token_auth import HASH_PATTERN
from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, model_validator


class Action(StrEnum):
    """What may be done to a subject: creating, seeing, updating or deleting it."""

    create = "create"
    read = "read"
    update = "update"
    delete = "delete"


class Subject(StrEnum):
    """A part of a community that permissions are given on."""

    community = "community"
    modules = "modules"
    resources = "resources"
    secrets = "secrets"
    tokens = "tokens"
    grants = "grants"
    managed_grants = "managed_grants"
    allowed_types = "allowed_types"


class Permission(BaseModel):
    """An action on a subject of a community."""

    model_config = ConfigDict(frozen=True)

    action: Action
    subject: Subject

    @classmethod
    def all(cls) -> list[Permission]:
        """Every action on every subject, by subject and then action, in the order they are declared."""
        return [cls(action=action, subject=subject) for subject in Subject for action in Action]


class Role(StrEnum):
    """A named set of permissions, granted on a community."""

    community_admin = "community_admin"
    community_editor = "community_editor"
    integration = "integration"


CLIENT_ROLES = frozenset({Role.integration})
"""The roles only a client may hold, never a person."""


def _permissions(subject: Subject, *actions: Action) -> frozenset[Permission]:
    return frozenset(Permission(action=action, subject=subject) for action in actions)


ROLE_PERMISSIONS: Mapping[Role, frozenset[Permission]] = {
    # Everything in their community, except changing the community itself or which types it may use.
    Role.community_admin: frozenset(Permission.all())
    - _permissions(Subject.community, Action.create, Action.update, Action.delete)
    - _permissions(Subject.allowed_types, Action.create, Action.update, Action.delete)
    - _permissions(Subject.managed_grants, *Action),
    # Seeing their community and changing what is configured in it: its modules, but not which there are.
    Role.community_editor: _permissions(Subject.community, Action.read)
    | _permissions(Subject.modules, Action.read, Action.update)
    | _permissions(Subject.resources, *Action)
    | _permissions(Subject.secrets, *Action),
    # A program looking after a community it created for someone else: its tokens, and who has access to it - through
    # the grants it manages only.
    Role.integration: _permissions(Subject.community, Action.read)
    | _permissions(Subject.tokens, *Action)
    | _permissions(Subject.grants, Action.read)
    | _permissions(Subject.managed_grants, Action.update),
}
"""The permissions each role carries, the only place a role turns into what it allows."""


class GlobalRole(StrEnum):
    """A named set of permissions outside any one community."""

    community_creator = "community_creator"


GLOBAL_ROLE_PERMISSIONS: Mapping[GlobalRole, frozenset[Permission]] = {
    GlobalRole.community_creator: _permissions(Subject.community, Action.create),
}
"""The permissions each global role carries, outside any one community."""


class Identity(BaseModel):
    """A person as an identity provider reported them at login."""

    model_config = ConfigDict(frozen=True)

    issuer: str
    subject: str
    email: str | None = None
    email_verified: bool = False
    name: str | None = None

    @classmethod
    def from_claims(cls, claims: Mapping[str, Any]) -> Identity:
        """The person an identity provider's claims say logged in, from an ID token or its userinfo endpoint."""
        return cls(
            issuer=claims["iss"],
            subject=claims["sub"],
            email=claims.get("email"),
            email_verified=claims.get("email_verified") in (True, "true"),
            name=claims.get("name"),
        )


# Stored from a Python-mode dump, which would otherwise keep the enum member.
StoredRole = Annotated[Role, PlainSerializer(lambda role: role.value, return_type=str)]
StoredGlobalRole = Annotated[GlobalRole, PlainSerializer(lambda role: role.value, return_type=str)]


class UserRecord(BaseModel):
    """A person who may do something, known by email until their first login binds their identity."""

    email: EmailStr = Field(description="The email address access was granted to.")
    issuer: str | None = Field(None, description="The identity provider of the person, bound at their first login.")
    subject: str | None = Field(None, description="The person's id at that identity provider, bound with it.")
    system_admin: bool = Field(False, description="Whether they may do anything, anywhere.")
    roles: list[StoredGlobalRole] = Field([], description="The roles they have outside any one community.")
    grants: dict[str, StoredRole] = Field({}, description="The role they have in each community, by slug.")
    managed_by: dict[str, str] = Field(
        {}, description="The client managing their grant, by slug, for the grants a client manages."
    )

    @model_validator(mode="after")
    def _check_managed_grants_exist(self):
        unknown = sorted(set(self.managed_by) - set(self.grants))
        if unknown:
            raise ValueError(f"{self.email} has managed grants in {', '.join(unknown)}, but no role there")
        return self

    @property
    def bound(self) -> bool:
        return self.subject is not None

    def has_email(self, email: str) -> bool:
        return str(self.email).casefold() == email.casefold()

    def matches(self, identity: Identity) -> bool:
        """Whether *identity* is this person.

        Once bound only the identity counts, so changing an email at the identity provider neither loses access nor
        hands it to whoever takes the old address. Before that, only a verified email does.
        """
        if self.bound:
            return (self.issuer, self.subject) == (identity.issuer, identity.subject)
        return identity.email_verified and identity.email is not None and self.has_email(identity.email)

    def bind(self, identity: Identity) -> None:
        self.issuer = identity.issuer
        self.subject = identity.subject


class ClientRecord(BaseModel):
    """A program that may do something, known by the API key it sends."""

    name: str = Field(description="The machine name of the client.", pattern=NAME_PATTERN)
    hash: str = Field(description="The hash of its API key, see `cofy.api.token_auth.hash_key`.", pattern=HASH_PATTERN)
    roles: list[StoredGlobalRole] = Field([], description="The roles it has outside any one community.")
    grants: dict[str, StoredRole] = Field({}, description="The role it has in each community, by slug.")


class Grant(BaseModel):
    """A role in one community, granted to the person with an email."""

    email: EmailStr = Field(description="The email address of the person the role is granted to.")
    role: Role = Field(description="The role granted.")
    bound: bool = Field(False, description="Whether that person has logged in since; reported, never written.")
    managed_by: str | None = Field(None, description="The client managing the grant, if one does; reported.")


class UsersFile(BaseModel):
    """Everyone who may do something, as stored."""

    # Read on every request, so an error in it must not quote what it holds back to whoever made one.
    model_config = ConfigDict(hide_input_in_errors=True)

    users: list[UserRecord] = []
    clients: list[ClientRecord] = []

    @model_validator(mode="after")
    def _check_emails_are_unique(self):
        emails = [str(user.email).casefold() for user in self.users]
        duplicates = sorted({email for email in emails if emails.count(email) > 1})
        if duplicates:
            raise ValueError(
                f"Each person can only be listed once, but {', '.join(duplicates)} is listed several times"
            )
        return self

    @model_validator(mode="after")
    def _check_clients_are_unique(self):
        for field in ("name", "hash"):
            values = [getattr(client, field) for client in self.clients]
            if len(set(values)) != len(values):
                raise ValueError(f"Each client needs a {field} of its own")
        return self
