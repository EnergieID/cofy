from __future__ import annotations

from abc import ABC, abstractmethod

from ..auth.access import ClientRecord, Identity, UserRecord


class UsersPersistence(ABC):
    """Everyone who may do something, as far as logging in is concerned: who someone is, and binding them - and the
    clients, known by their API keys."""

    @abstractmethod
    def match(self, identity: Identity) -> UserRecord | None:
        """The person *identity* is, if they are listed."""

    @abstractmethod
    def bind(self, identity: Identity) -> None:
        """Bind *identity* to the person still waiting for its first login, if there is one - or, for someone bound
        already, take on the verified email they log in with now, and what was granted to it meanwhile."""

    @abstractmethod
    def client(self, digest: str) -> ClientRecord | None:
        """The client whose API key hashes to *digest*, if there is one."""
