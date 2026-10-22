from __future__ import annotations

from typing import Annotated

from cofy.api import ResourceSettings
from cofy.modules.discovery import discover_all_types
from fastapi import Path

from ..auth.access import Subject
from ..domain.allowed import AllowedTypes
from ..domain.in_use import check_unused
from ..persitance.modules import ModulesPersistence
from ..persitance.resources import ResourcesPersistence
from ..policies.policy import Policy, PolicyRouter

# Import every installed module/source/format type,
discover_all_types()
AnyResourceSettings = ResourceSettings.union_type()


class ResourcesRouter:
    def __init__(self, persistence: ResourcesPersistence, modules: ModulesPersistence, allowed: AllowedTypes):
        self.persistence = persistence
        self.allowed = allowed
        self.modules = modules
        self.router = PolicyRouter(
            subject=Subject.resources, prefix="/management/communities/{slug}/resources", tags=["Resources"]
        )
        self._register_routes()

    def _register_routes(self) -> None:
        self.router.add_api_route("", self.all, methods=["GET"], rule=Policy.all, response_model_exclude_unset=True)
        self.router.add_api_route(
            "/{name}", self.get, methods=["GET"], rule=Policy.get, response_model_exclude_unset=True
        )
        self.router.add_api_route(
            "", self.create, methods=["POST"], rule=Policy.create, status_code=201, response_model_exclude_unset=True
        )
        self.router.add_api_route(
            "/{name}", self.put, methods=["PUT"], rule=Policy.put, response_model_exclude_unset=True
        )
        self.router.add_api_route("/{name}", self.delete, methods=["DELETE"], rule=Policy.delete, status_code=204)

    def all(
        self,
        slug: Annotated[str, Path(description="Community slug")],
    ) -> list[AnyResourceSettings]:
        return self.persistence.all(slug)

    def get(self, slug: str, name: str) -> AnyResourceSettings:
        return self.persistence.get(slug, name)

    def create(self, slug: str, payload: AnyResourceSettings) -> AnyResourceSettings:
        self.allowed.restrictions(slug).check(payload)
        return self.persistence.create(slug, payload)

    def put(self, slug: str, name: str, payload: AnyResourceSettings) -> AnyResourceSettings:
        if payload.name != name:
            raise ValueError(f"Resource name in body ({payload.name!r}) must match the URL path ({name!r})")
        self.allowed.restrictions(slug).check(payload)
        return self.persistence.replace(slug, name, payload)

    def delete(self, slug: str, name: str) -> None:
        self.persistence.get(slug, name)
        check_unused("resource", name, self.modules.all(slug), self.persistence.all(slug))
        self.persistence.delete(slug, name)
        return None
