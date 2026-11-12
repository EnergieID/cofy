from __future__ import annotations

from abc import ABC, abstractmethod

from ..auth.access import Account, Grant, Role


class GrantsPersistence(ABC):
    """The roles granted in each community, to the people and clients they are granted to."""

    @abstractmethod
    def all(self, slug: str) -> list[Grant]:
        """List the grants to people in a community."""

    @abstractmethod
    def get(self, slug: str, email: str) -> Grant:
        """Get the grant to *email* in a community."""

    @abstractmethod
    def create(self, slug: str, grant: Grant) -> Grant:
        """Grant a role in a community, failing if that person already has one there."""

    @abstractmethod
    def replace(self, slug: str, email: str, grant: Grant) -> Grant:
        """Replace the grant to *email* in a community, failing if a client manages it."""

    @abstractmethod
    def delete(self, slug: str, email: str) -> None:
        """Revoke the grant to *email* in a community, failing if a client manages it."""

    @abstractmethod
    def delete_all(self, slug: str) -> None:
        """Revoke every grant in a community, to people and clients alike, for when it is deleted."""

    @abstractmethod
    def grant_client(self, slug: str, client: str, role: Role) -> None:
        """Grant the client named *client* a role in a community."""

    @abstractmethod
    def replace_managed(
        self, slug: str, client: str, grants: list[tuple[Grant, Account | None]]
    ) -> tuple[list[Grant], list[str]]:
        """Make *grants* the grants *client* manages in a community: granting, changing and revoking its own grants
        to match. A grant with an account goes to that account from the start, rather than from the person's first
        login. A person with a grant of someone else's keeps it, as does an email bound to another account than the
        one given; either is reported back by email as skipped.

        Returns the grants the client manages afterwards, and the emails skipped.
        """
