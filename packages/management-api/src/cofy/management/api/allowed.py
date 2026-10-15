"""The routes restricting which types each community may use.

A system admin sees and replaces each type's availability - allowed by default or not, but for its exceptions - as a
whole. Each community's view of the same, one type at a time, is `community_allowed_types`; what a community may
configure as a result, its catalogs list.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Body
from pydantic import Field

from ..auth.access import Subject
from ..domain.allowed import AllowedTypes
from ..domain.availability import Availability
from ..persitance.communities import CommunitiesPersistence
from ..policies.policy import Policy, PolicyRouter


class TypeAvailability(Availability):
    """Which communities may use a type."""

    group: str = Field(description="What the type is a type of: `module`, `resource`, or the resource kind holding it.")
    type: str = Field(description="Machine name of the type.")
    description: str = Field(description="What the type is for.")


class AllowedTypesRouter:
    def __init__(self, allowed: AllowedTypes, communities: CommunitiesPersistence):
        self.allowed = allowed
        self.communities = communities
        self.router = PolicyRouter(subject=Subject.allowed_types, prefix="/management", tags=["Allowed types"])
        self.router.add_api_route("/allowed-types", self.all, methods=["GET"], rule=Policy.all)
        self.router.add_api_route("/allowed-types/{group}/{type_name}", self.put, methods=["PUT"], rule=Policy.put)

    def all(self) -> list[TypeAvailability]:
        """List every type, with the communities that may use it."""
        return [
            TypeAvailability(
                group=type_.group, type=type_.name, description=type_.description, **availability.model_dump()
            )
            for type_, availability in self.allowed.availability()
        ]

    def put(
        self,
        group: str,
        type_name: str,
        payload: Annotated[Availability, Body(description="Which communities may use the type")],
    ) -> TypeAvailability:
        """Replace which communities may use a type."""
        type_ = self.allowed.get(group, type_name)
        known = {slug for slug, _ in self.communities.all()}
        unknown = [slug for slug in payload.exceptions if slug not in known]
        if unknown:
            raise ValueError(f"There is no community {', '.join(map(repr, unknown))}")
        stored = self.allowed.persistence.put(group, type_name, payload)
        return TypeAvailability(group=group, type=type_name, description=type_.description, **stored.model_dump())
