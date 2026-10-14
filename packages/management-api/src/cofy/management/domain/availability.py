"""Which communities may use a type, as system admins restrict it."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class Availability(BaseModel):
    """Whether the communities may configure a type: by default, but for the exceptions."""

    default: bool = Field(True, description="Whether a community may configure the type, unless it is an exception.")
    exceptions: list[str] = Field(
        [], description="The communities, by slug, for which the opposite of the default holds."
    )

    @field_validator("exceptions")
    @classmethod
    def _sorted(cls, exceptions: list[str]) -> list[str]:
        return sorted(set(exceptions))

    def allows(self, slug: str) -> bool:
        return self.default != (slug in self.exceptions)

    def allowing(self, slug: str, allowed: bool) -> Availability:
        """This availability, changed to allow the type to *slug* or not: as an exception to its default, or no
        longer one."""
        others = [exception for exception in self.exceptions if exception != slug]
        return Availability(default=self.default, exceptions=others if allowed == self.default else [*others, slug])

    def is_default(self) -> bool:
        """Whether this is the availability of a type nobody restricted: everywhere."""
        return self == Availability()
