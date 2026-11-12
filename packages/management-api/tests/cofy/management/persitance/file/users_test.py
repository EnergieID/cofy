"""The users file at login: who an identity is, and binding them at their first login."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from cofy.management.auth.access import Role
from cofy.management.errors import StoredDataInvalidError
from cofy.management.persitance.file.users import FileUsersPersistence

from ...access_fixture import ISSUER, identity


def users_file(tmp_path: Path, *users: dict) -> Path:
    path = tmp_path / "access" / "users.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump({"users": list(users)}))
    return path


def stored(path: Path) -> list[dict]:
    return yaml.safe_load(path.read_text())["users"]


def test_without_a_file_nobody_is_listed(tmp_path: Path):
    assert FileUsersPersistence(tmp_path / "missing.yaml").match(identity("admin")) is None


def test_a_file_listing_someone_twice_is_refused_without_saying_who(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    path = users_file(tmp_path, {"email": "ann@example.com"}, {"email": "ANN@example.com"})

    with pytest.raises(StoredDataInvalidError) as refused:
        FileUsersPersistence(path).match(identity("ann"))

    assert "ann@example.com" not in str(refused.value)
    # What's wrong is logged instead, for whoever keeps the file.
    assert "ann@example.com" in caplog.text


def test_an_empty_file_is_refused_as_truncated(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    path = tmp_path / "users.yaml"
    path.write_text("")

    with pytest.raises(StoredDataInvalidError) as refused:
        FileUsersPersistence(path).match(identity("ann"))

    assert str(path) not in str(refused.value)
    assert "mapping" in caplog.text


def test_an_invalid_value_is_not_quoted_even_in_the_log(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    path = users_file(tmp_path, {"email": "ann@example.com", "grants": {"demo": "comunity_admin"}})

    with pytest.raises(StoredDataInvalidError):
        FileUsersPersistence(path).match(identity("ann"))

    assert "users.0.grants.demo" in caplog.text
    assert "comunity_admin" not in caplog.text


# ── logging in ────────────────────────────────────────────────────────────


def test_matches_the_person_an_identity_is(tmp_path: Path):
    users = FileUsersPersistence(users_file(tmp_path, {"email": "admin@example.com", "system_admin": True}))

    found = users.match(identity("admin"))

    assert found is not None and found.system_admin
    assert users.match(identity("ann")) is None


def test_binding_writes_the_identity_into_the_file(tmp_path: Path):
    path = users_file(tmp_path, {"email": "admin@example.com", "system_admin": True}, {"email": "other@example.com"})

    FileUsersPersistence(path).bind(identity("admin"))

    assert stored(path) == [
        {"email": "admin@example.com", "issuer": ISSUER, "subject": "admin-sub", "system_admin": True},
        {"email": "other@example.com"},
    ]


def test_a_bound_person_stays_themselves_whatever_their_email_becomes(tmp_path: Path):
    path = users_file(tmp_path, {"email": "admin@example.com", "issuer": ISSUER, "subject": "admin-sub"})

    renamed = identity("admin").model_copy(update={"email": "new@example.com"})

    assert FileUsersPersistence(path).match(renamed) is not None


def test_binding_without_a_match_leaves_the_file_alone(tmp_path: Path):
    path = users_file(tmp_path, {"email": "admin@example.com", "grants": {"demo": Role.community_admin.value}})
    before = path.read_text()

    FileUsersPersistence(path).bind(identity("ann"))

    assert path.read_text() == before


# ── a changed email ───────────────────────────────────────────────────────

ADMIN_BOUND = {"email": "admin@example.com", "issuer": ISSUER, "subject": "admin-sub"}


def renamed(email: str = "new@example.com", *, verified: bool = True):
    return identity("admin").model_copy(update={"email": email, "email_verified": verified})


def test_a_login_with_a_changed_email_keeps_it(tmp_path: Path):
    path = users_file(tmp_path, {**ADMIN_BOUND, "grants": {"demo": "community_admin"}})

    FileUsersPersistence(path).bind(renamed())

    assert stored(path) == [{**ADMIN_BOUND, "email": "new@example.com", "grants": {"demo": "community_admin"}}]


def test_a_login_with_a_changed_email_takes_what_was_granted_to_it(tmp_path: Path):
    path = users_file(
        tmp_path,
        {**ADMIN_BOUND, "grants": {"demo": "community_admin"}},
        {
            "email": "new@example.com",
            "grants": {"demo": "community_editor", "other": "community_editor"},
            "managed_by": {"other": "energyid"},
        },
    )

    FileUsersPersistence(path).bind(renamed())

    assert stored(path) == [
        {
            **ADMIN_BOUND,
            "email": "new@example.com",
            "grants": {"demo": "community_admin", "other": "community_editor"},
            "managed_by": {"other": "energyid"},
        }
    ]


def test_a_login_with_an_unverified_email_keeps_the_old_one(tmp_path: Path):
    path = users_file(tmp_path, ADMIN_BOUND)

    FileUsersPersistence(path).bind(renamed(verified=False))

    assert stored(path) == [ADMIN_BOUND]


def test_a_login_with_the_email_of_another_account_keeps_the_old_one(tmp_path: Path):
    other = {"email": "new@example.com", "issuer": ISSUER, "subject": "someone-else"}
    path = users_file(tmp_path, ADMIN_BOUND, other)

    FileUsersPersistence(path).bind(renamed())

    assert stored(path) == [ADMIN_BOUND, other]
