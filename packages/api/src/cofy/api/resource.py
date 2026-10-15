"""Named resources: values configured once and referenced from anywhere in a configuration."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from .from_settings_mixin import BaseSettingsModel, FromSettingsMixin


class ResourceSettings(BaseSettingsModel):
    type: Literal["resource"] = "resource"
    name: str = Field(
        description="The machine name of the resource, by which it is referenced. No spaces, no special characters.",
        pattern=r"^[a-zA-Z0-9_-]+$",
    )
    description: str | None = Field(None, description="A short description of the resource.")

    @classmethod
    def held_types(cls) -> "dict[str, type[BaseModel]]":
        """The types of value a resource of this kind holds, by name: its value's, under the kind's own name."""
        return {cls.model_fields["type"].default: cls.model_fields["value"].annotation}

    def resolve(self) -> Any:
        """What a reference to this resource stands for: its value, built."""
        return self.convert().value


class Resource(FromSettingsMixin, settings=ResourceSettings, abstract=True):
    """A named value that can be referenced from anywhere in a configuration."""

    def __init__(self, name: str, value: Any, description: str | None = None):
        self.name = name
        self.value = value
        self.description = description
