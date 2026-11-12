from typing import cast

from ...auth.access import ClientRecord, Identity, UserRecord, UsersFile
from ..users import UsersPersistence
from .base import UsersFileStore


class FileUsersPersistence(UsersFileStore, UsersPersistence):
    def match(self, identity: Identity) -> UserRecord | None:
        with self._open_users("read") as users:
            return next((user for user in users.users if user.matches(identity)), None)

    def bind(self, identity: Identity) -> None:
        # Checked under a shared lock first, so a login only takes an exclusive one when it changes something.
        with self._open_users("read") as users:
            if not self._binds(users, identity):
                return
        with self._open_users("write") as users:
            if self._binds(users, identity):
                self._bind(users, identity)

    @staticmethod
    def _bound(users: UsersFile, identity: Identity) -> UserRecord | None:
        return next((user for user in users.users if user.bound and user.matches(identity)), None)

    @staticmethod
    def _waiting(users: UsersFile, identity: Identity) -> UserRecord | None:
        return next((user for user in users.users if not user.bound and user.matches(identity)), None)

    def _binds(self, users: UsersFile, identity: Identity) -> bool:
        """Whether logging in as *identity* changes the file: binding them, or their email having changed."""
        person = self._bound(users, identity)
        if person is None:
            return self._waiting(users, identity) is not None
        return (
            identity.email_verified
            and identity.email is not None
            and not person.has_email(identity.email)
            # An email another account has is theirs; this person keeps their own.
            and not any(user.bound and user.has_email(identity.email) for user in users.users)
        )

    def _bind(self, users: UsersFile, identity: Identity) -> None:
        waiting = self._waiting(users, identity)
        person = self._bound(users, identity)
        if person is None:
            cast(UserRecord, waiting).bind(identity)
            return
        if waiting is not None:
            # Granted to their new email before they logged in with it: theirs now, beside what they have.
            users.users.remove(waiting)
            for slug, role in waiting.grants.items():
                if slug not in person.grants:
                    person.grants[slug] = role
                    if slug in waiting.managed_by:
                        person.managed_by[slug] = waiting.managed_by[slug]
            person.roles = [*person.roles, *(role for role in waiting.roles if role not in person.roles)]
            person.system_admin = person.system_admin or waiting.system_admin
        person.email = cast(str, identity.email)

    def client(self, digest: str) -> ClientRecord | None:
        with self._open_users("read") as users:
            return next((client for client in users.clients if client.hash == digest), None)
