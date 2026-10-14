"""Which types one community may use, each allowed to it or not.

The same restrictions `/allowed-types` lists per type, seen from one community. Allowing a type here keeps its default
for the others: the community becomes an exception to it, or no longer is one.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Body, Path
from pydantic import BaseModel, Field

from ..auth.access import Subject
from ..domain.allowed import AllowedType, AllowedTypes
from ..persitance.communities import CommunitiesPersistence
from ..policies.policy import Policy, PolicyRouter


class AllowedBody(BaseModel):
    """Whether a community may use a type."""

    allowed: bool = Field(description="Whether the community may use the type.")


class CommunityTypeAvailability(AllowedBody):
    """A type, and whether one community may use it."""

    group: str = Field(description="What the type is a type of: `module`, `resource`, or the resource kind holding it.")
    type: str = Field(description="Machine name of the type.")
    description: str = Field(description="What the type is for.")

    @classmethod
    def of(cls, type_: AllowedType, allowed: bool) -> CommunityTypeAvailability:
        return cls(group=type_.group, type=type_.name, description=type_.description, allowed=allowed)


class CommunityAllowedTypesRouter:
    def __init__(self, allowed: AllowedTypes, communities: CommunitiesPersistence):
        self.allowed = allowed
        self.communities = communities
        self.router = PolicyRouter(
            subject=Subject.allowed_types, prefix="/management/communities/{slug}/allowed-types", tags=["Allowed types"]
        )
        self.router.add_api_route("", self.all, methods=["GET"], rule=Policy.all)
        self.router.add_api_route("/{group}/{type_name}", self.put, methods=["PUT"], rule=Policy.put)

    def all(self, slug: Annotated[str, Path(description="Community slug")]) -> list[CommunityTypeAvailability]:
        """List every type, with whether this community may use it."""
        self.communities.get(slug)
        return [CommunityTypeAvailability.of(type_, allowed) for type_, allowed in self.allowed.in_community(slug)]

    def put(
        self,
        slug: str,
        group: str,
        type_name: str,
        payload: Annotated[AllowedBody, Body(description="Whether this community may use the type")],
    ) -> CommunityTypeAvailability:
        """Allow a type to this community or not, keeping its default for the others."""
        self.communities.get(slug)
        type_ = self.allowed.set_allowed(slug, group, type_name, payload.allowed)
        return CommunityTypeAvailability.of(type_, payload.allowed)
