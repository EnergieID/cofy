"""What a community may configure of one family - module types or resource kinds - with their JSON Schemas.

A catalog is the frontend's entry point for building any module or resource UI. Its schemas leave out the types the
community may not use, as the routers storing modules and resources check writes against the same restrictions. They
are generated here rather than leaving clients to mine `/openapi.json`, because `mode="validation"` names the one
schema that governs writes and keeps every `$ref` local to the schema it appears in.
"""

from __future__ import annotations

from typing import Annotated, Any

from cofy.api import BaseSettingsModel
from fastapi import Path
from pydantic import BaseModel, ConfigDict, Field

from ..auth.access import Subject
from ..domain.allowed import AllowedTypes, describe
from ..policies.policy import Policy, PolicyRouter


class CatalogEntry(BaseModel):
    """A module type or resource kind a community may configure."""

    model_config = ConfigDict(populate_by_name=True)

    type: str = Field(description="Machine name, and the discriminator value in a payload of this type.")
    description: str = Field(description="What the type is for.")
    json_schema: dict[str, Any] = Field(
        alias="schema",
        description="Self-contained JSON Schema for a full payload of this type, as the community may configure it.",
    )


class CatalogRouter:
    """The catalog of *family*, at `catalog/{path}` of each community, seen by whoever may see what it configures."""

    def __init__(
        self, allowed: AllowedTypes, family: type[BaseSettingsModel], *, subject: Subject, path: str, tag: str
    ):
        self.allowed = allowed
        self.family = family
        self.router = PolicyRouter(subject=subject, prefix="/management/communities/{slug}/catalog", tags=[tag])
        self.router.add_api_route(f"/{path}", self.all, methods=["GET"], rule=Policy.all)

    def all(self, slug: Annotated[str, Path(description="Community slug")]) -> list[CatalogEntry]:
        """List what this community may configure."""
        restrictions = self.allowed.restrictions(slug)
        return [
            CatalogEntry(type=name, description=describe(settings), schema=restrictions.schema(settings))
            for name, settings in restrictions.catalog(self.family).items()
        ]
