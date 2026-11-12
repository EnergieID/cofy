"""Who has access to a community: roles granted by email, bound to the person's identity at their first login.

They are kept with the people they are granted to, rather than in the community's config. A client may manage some of
them for a community it looks after, replacing those as a whole; only it changes them.
"""

from __future__ import annotations

from typing import Annotated, cast

from fastapi import Body, Depends, Path
from pydantic import BaseModel, EmailStr, Field, field_validator

from ..auth.access import CLIENT_ROLES, Grant, Role, Subject
from ..auth.user import Client, Principal, current_principal
from ..persitance.communities import CommunitiesPersistence
from ..persitance.grants import GrantsPersistence
from ..policies.managed_grants import ManagedGrantsPolicy
from ..policies.policy import Policy, PolicyRouter


class GrantBody(BaseModel):
    """A grant as written; who it is bound to is only ever set by that person logging in."""

    email: EmailStr = Field(description="The email address of the person the role is granted to.")
    role: Role = Field(description="The role granted.")

    @field_validator("role")
    @classmethod
    def _check_role_is_for_people(cls, role: Role) -> Role:
        if role in CLIENT_ROLES:
            raise ValueError(f"{role.value!r} is a role for clients, not people")
        return role


class GrantInfo(BaseModel):
    """A grant as reported."""

    email: str
    role: Role
    bound: bool = Field(description="Whether the person has logged in since, tying the grant to their account.")
    managed_by: str | None = Field(description="The client managing the grant, which alone may change it.")

    @classmethod
    def of(cls, grant: Grant) -> GrantInfo:
        return cls(email=str(grant.email), role=grant.role, bound=grant.bound, managed_by=grant.managed_by)


class ManagedGrants(BaseModel):
    """The grants a client manages in a community, after replacing them."""

    grants: list[GrantInfo]
    skipped: list[str] = Field(description="The emails not granted: they have a role there the client doesn't manage.")


class GrantsRouter:
    def __init__(self, persistence: GrantsPersistence, communities: CommunitiesPersistence):
        self.persistence = persistence
        self.communities = communities
        self.router = PolicyRouter(
            subject=Subject.grants, prefix="/management/communities/{slug}/grants", tags=["Grants"]
        )
        self.router.add_api_route("", self.all, methods=["GET"], rule=Policy.all)
        self.router.add_api_route("/{email}", self.get, methods=["GET"], rule=Policy.get)
        self.router.add_api_route("", self.create, methods=["POST"], rule=Policy.create, status_code=201)
        self.router.add_api_route("/{email}", self.put, methods=["PUT"], rule=Policy.put)
        self.router.add_api_route("/{email}", self.delete, methods=["DELETE"], rule=Policy.delete, status_code=204)

    def all(self, slug: Annotated[str, Path(description="Community slug")]) -> list[GrantInfo]:
        self.communities.get(slug)
        return [GrantInfo.of(grant) for grant in self.persistence.all(slug)]

    def get(self, slug: str, email: str) -> GrantInfo:
        self.communities.get(slug)
        return GrantInfo.of(self.persistence.get(slug, email))

    def create(self, slug: str, payload: GrantBody) -> GrantInfo:
        self.communities.get(slug)
        return GrantInfo.of(self.persistence.create(slug, Grant(email=payload.email, role=payload.role)))

    def put(self, slug: str, email: str, payload: GrantBody) -> GrantInfo:
        """Change the role granted; a different person is a grant of its own."""
        if str(payload.email).casefold() != email.casefold():
            raise ValueError(f"Email in body ({str(payload.email)!r}) must match the URL path ({email!r})")
        self.communities.get(slug)
        return GrantInfo.of(self.persistence.replace(slug, email, Grant(email=payload.email, role=payload.role)))

    def delete(self, slug: str, email: str) -> None:
        self.communities.get(slug)
        self.persistence.delete(slug, email)
        return None


class ManagedGrantsRouter:
    """The grants a client manages in a community, replaced as a whole."""

    def __init__(self, persistence: GrantsPersistence, communities: CommunitiesPersistence):
        self.persistence = persistence
        self.communities = communities
        self.router = PolicyRouter(
            subject=Subject.managed_grants,
            policy=ManagedGrantsPolicy,
            prefix="/management/communities/{slug}/managed-grants",
            tags=["Grants"],
        )
        self.router.add_api_route("", self.replace, methods=["PUT"], rule=ManagedGrantsPolicy.put)

    def replace(
        self,
        slug: Annotated[str, Path(description="Community slug")],
        payload: Annotated[list[GrantBody], Body(description="Every grant the client manages here.")],
        principal: Annotated[Principal, Depends(current_principal)],
    ) -> ManagedGrants:
        """Replace the grants the client asking manages in the community with these, leaving every other grant be."""
        emails = [str(grant.email).casefold() for grant in payload]
        if len(set(emails)) != len(emails):
            raise ValueError("Each person can only be listed once")
        self.communities.get(slug)
        # The policy lets only a client through.
        client = cast(Client, principal)
        managed, skipped = self.persistence.replace_managed(
            slug, client.name, [Grant(email=grant.email, role=grant.role) for grant in payload]
        )
        return ManagedGrants(grants=[GrantInfo.of(grant) for grant in managed], skipped=skipped)
