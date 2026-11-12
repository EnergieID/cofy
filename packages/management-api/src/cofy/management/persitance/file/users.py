from ...auth.access import ClientRecord, Identity, UserRecord
from ..users import UsersPersistence
from .base import UsersFileStore


class FileUsersPersistence(UsersFileStore, UsersPersistence):
    def match(self, identity: Identity) -> UserRecord | None:
        with self._open_users("read") as users:
            return next((user for user in users.users if user.matches(identity)), None)

    def bind(self, identity: Identity) -> None:
        # Checked under a shared lock first, so a login only takes an exclusive one when it changes something.
        with self._open_users("read") as users:
            if not any(not user.bound and user.matches(identity) for user in users.users):
                return
        with self._open_users("write") as users:
            for user in users.users:
                if not user.bound and user.matches(identity):
                    user.bind(identity)

    def client(self, digest: str) -> ClientRecord | None:
        with self._open_users("read") as users:
            return next((client for client in users.clients if client.hash == digest), None)
