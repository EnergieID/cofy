from typing import TYPE_CHECKING, Literal

from cofy.api import Resource, ResourceSettings

from .source import MemberSourceSettings

if TYPE_CHECKING:
    # Published at runtime by finalize(); the base class is the static stand-in.
    AnyMemberSourceSettings = MemberSourceSettings


class MemberSourceResourceSettings(ResourceSettings):
    type: Literal["member_source"] = "member_source"
    # Unresolved until cofy.api.finalize() publishes the discriminated unions.
    value: "AnyMemberSourceSettings"

    @classmethod
    def held_types(cls) -> "dict[str, type[MemberSourceSettings]]":
        # Each type of member source is a type of its own.
        return MemberSourceSettings.registry()


class MemberSourceResource(Resource, settings=MemberSourceResourceSettings):
    """A source of members, built once and shared by every reference to it."""
