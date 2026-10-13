from __future__ import annotations

from ..auth.access import Action, Subject
from ..auth.user import User
from .policy import Policy


class CommunityPolicy(Policy):
    """The rules for communities themselves, which differ in one place: listing them takes being able to see one."""

    def all(self) -> bool:
        return any(self.user.can(Action.read, Subject.community, slug) for slug in self.user.communities())

    @staticmethod
    def scope(user: User, slugs: list[str]) -> list[str]:
        """The communities among *slugs* that *user* may see."""
        return [slug for slug in slugs if user.can(Action.read, Subject.community, slug)]
