from __future__ import annotations

from ..auth.user import Client
from .policy import Policy, Rule


class ManagedGrantsPolicy(Policy):
    """The rules for the grants a client manages, which only a client may: they are managed under its name, which
    nobody else has - a system admin included."""

    def allows(self, rule: Rule) -> bool:
        return isinstance(self.user, Client) and rule(self)
