"""The types a system admin restricts per community, and what each community may configure as a result.

A type is a module type, or a type of what a resource holds: for most kinds of resource its value - a `tariff`, say -
but for a kind holding a family of values, each member of it - each type of `source`. Each belongs to a group, which
tells them apart: `module`, `resource`, or the kind holding the family. A type a community may not use, it can't give
anywhere: not as a module, not in a resource, and not inline in a module or another resource either.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from typing import Any

from cofy.api import BaseSettingsModel, ModuleSettings, ResourceSettings, schema_without
from cofy.api.references import iter_models
from cofy.modules.discovery import discover_all_types
from pydantic import BaseModel
from pydantic.json_schema import GenerateJsonSchema

from ..errors import ResourceNotFoundError
from ..persitance.allowed import AllowedPersistence
from .availability import Availability

# Import every installed module/source/format type, so the registry is complete.
discover_all_types()


@dataclass(frozen=True)
class AllowedType:
    """A type a system admin may allow per community."""

    group: str
    name: str
    cls: type[BaseModel]
    """What a value of the type is."""
    description: str
    configures: type[BaseSettingsModel]
    """The module type or resource kind a community may configure while it may use this type."""


def describe(settings: type[BaseSettingsModel]) -> str:
    """What the type *settings* configures is for, as the class built from them says."""
    return settings.describe()


def installed_types() -> list[AllowedType]:
    """Every installed type, modules first, then by group and name."""
    types = [
        AllowedType("module", name, settings, describe(settings), settings)
        for name, settings in ModuleSettings.registry().items()
    ]
    for kind, settings in ResourceSettings.registry().items():
        for name, cls in settings.held_types().items():
            if name == kind:
                types.append(AllowedType("resource", name, cls, describe(settings), settings))
            else:
                types.append(AllowedType(kind, name, cls, describe(cls), settings))
    return sorted(types, key=lambda type_: (type_.group != "module", type_.group, type_.name))


class AllowedTypes:
    """The installed types, and which of them each community may use."""

    def __init__(self, persistence: AllowedPersistence):
        self.persistence = persistence
        # What is installed is known once every type is imported, and doesn't change while running.
        self.types = installed_types()

    def get(self, group: str, name: str) -> AllowedType:
        type_ = next((type_ for type_ in self.types if (type_.group, type_.name) == (group, name)), None)
        if type_ is None:
            raise ResourceNotFoundError(f"There is no {group} type {name!r}")
        return type_

    def availability(self) -> list[tuple[AllowedType, Availability]]:
        """Every type, with which communities may use it."""
        stored = self.persistence.all()
        return [(type_, stored.get(type_.group, {}).get(type_.name, Availability())) for type_ in self.types]

    def in_community(self, slug: str) -> list[tuple[AllowedType, bool]]:
        """Every type, with whether *slug* may use it."""
        return [(type_, availability.allows(slug)) for type_, availability in self.availability()]

    def set_allowed(self, slug: str, group: str, name: str, allowed: bool) -> AllowedType:
        """Allow the type *group* and *name* identify to *slug* or not."""
        type_ = self.get(group, name)
        self.persistence.set_allowed(group, name, slug, allowed)
        return type_

    def restrictions(self, slug: str) -> Restrictions:
        """What *slug* may not use, read once for whatever is asked of it next."""
        disallowed = [type_ for type_, availability in self.availability() if not availability.allows(slug)]
        return Restrictions(slug, self.types, disallowed)


@dataclass(frozen=True)
class Restrictions:
    """The types one community may not use, and what follows from them for it."""

    slug: str
    types: list[AllowedType]
    disallowed: list[AllowedType]

    def catalog(self, family: type[BaseSettingsModel]) -> dict[str, type[BaseSettingsModel]]:
        """What the community may configure of *family* - module types or resource kinds - by type tag: each of which
        it may use one of the types."""
        configurable = {type_.configures for type_ in self.types if type_ not in self.disallowed}
        return {tag: settings for tag, settings in sorted(family.registry().items()) if settings in configurable}

    def check(self, payload: BaseModel) -> None:
        """Reject *payload* when it is, or holds anywhere in it, a type the community may not use."""
        disallowed = {type_.cls: type_ for type_ in self.disallowed}
        for model in iter_models(payload):
            if type(model) in disallowed:
                raise ValueError(f"{disallowed[type(model)].name!r} is not allowed for community {self.slug!r}")

    def schema(self, settings: type[BaseSettingsModel]) -> dict[str, Any]:
        """The JSON Schema of *settings* for the community, leaving out the types it may not use."""
        return settings.model_json_schema(mode="validation", schema_generator=self._generator)

    @cached_property
    def _generator(self) -> type[GenerateJsonSchema]:
        return schema_without({type_.cls for type_ in self.disallowed})
