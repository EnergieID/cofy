from __future__ import annotations

from abc import ABC, abstractmethod

from ..domain.availability import Availability


class AllowedPersistence(ABC):
    """Which types the communities may configure; a type nobody restricted, every community may."""

    @abstractmethod
    def all(self) -> dict[str, dict[str, Availability]]:
        """The availability of every restricted type, by group and name."""

    def get(self, group: str, name: str) -> Availability:
        return self.all().get(group, {}).get(name, Availability())

    @abstractmethod
    def put(self, group: str, name: str, availability: Availability) -> Availability:
        """Replace the availability of a type."""

    @abstractmethod
    def set_allowed(self, group: str, name: str, slug: str, allowed: bool) -> Availability:
        """Allow a type to one community or not, keeping its default; in one step, so no other change is lost."""

    @abstractmethod
    def forget(self, slug: str) -> None:
        """Drop a community from every type's exceptions, for when it is deleted."""
