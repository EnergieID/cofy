import builtins
from abc import ABC, abstractmethod
from typing import Any, Generic, Literal, TypeVar

from cofy.api import BaseSettingsModel, FromSettingsMixin, Referable

from .model import Member

T = TypeVar("T")


class MemberSourceSettings(BaseSettingsModel):
    type: Literal["member"] = "member"

    @classmethod
    def union_annotations(cls) -> tuple[Any, ...]:
        # Wherever a source of members fits, a reference to a member source resource holding one fits too.
        return (Referable("member_source", family=cls),)


class MemberSource(FromSettingsMixin, ABC, Generic[T], settings=MemberSourceSettings, abstract=True):
    @abstractmethod
    def list(
        self,
    ) -> builtins.list[T]:
        """List all members."""

    @abstractmethod
    def get(self, member_id: str) -> T | None:
        """Return a single member by ID."""

    @abstractmethod
    def verify(self, activation_code: str) -> T | None:
        """Return member matching the activation code."""

    @property
    def response_model(self) -> type:
        """The response model of the source."""
        return Member
