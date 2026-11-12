"""Grants, as kept in the users file with the people they are granted to."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from cofy.management.auth.access import Account, Grant, Role
from cofy.management.errors import ResourceAlreadyExistsError, ResourceManagedError, ResourceNotFoundError
from cofy.management.persitance.file.grants import FileGrantsPersistence

from ...access_fixture import ISSUER, client_record

ADMIN = Role.community_admin


def users_file(tmp_path: Path, *users: dict) -> Path:
    path = tmp_path / "access" / "users.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump({"users": list(users)}))
    return path


def stored(path: Path) -> list[dict]:
    return yaml.safe_load(path.read_text())["users"]


def grant(email: str = "ann@example.com") -> Grant:
    return Grant(email=email, role=ADMIN)


def test_lists_the_grants_in_a_community_with_whether_their_person_logged_in(tmp_path: Path):
    path = users_file(
        tmp_path,
        {"email": "ann@example.com", "issuer": ISSUER, "subject": "ann-sub", "grants": {"test": "community_admin"}},
        {"email": "bob@example.com", "grants": {"test": "community_admin", "other": "community_admin"}},
        {"email": "cas@example.com", "grants": {"other": "community_admin"}},
    )

    assert FileGrantsPersistence(path).all("test") == [
        Grant(email="ann@example.com", role=ADMIN, bound=True),
        Grant(email="bob@example.com", role=ADMIN, bound=False),
    ]


def test_the_first_grant_creates_the_file(tmp_path: Path):
    path = tmp_path / "access" / "users.yaml"

    FileGrantsPersistence(path).create("test", grant())

    assert stored(path) == [{"email": "ann@example.com", "grants": {"test": "community_admin"}}]


def test_a_grant_in_another_community_is_added_to_the_same_person(tmp_path: Path):
    path = users_file(tmp_path, {"email": "ann@example.com", "grants": {"test": "community_admin"}})

    FileGrantsPersistence(path).create("other", grant("ANN@example.com"))

    assert stored(path) == [
        {"email": "ann@example.com", "grants": {"test": "community_admin", "other": "community_admin"}}
    ]


def test_granting_twice_in_one_community_fails(tmp_path: Path):
    grants = FileGrantsPersistence(tmp_path / "users.yaml")
    grants.create("test", grant())

    with pytest.raises(ResourceAlreadyExistsError):
        grants.create("test", grant("Ann@Example.com"))


def test_a_grant_someone_does_not_have_is_not_found(tmp_path: Path):
    path = users_file(tmp_path, {"email": "ann@example.com", "grants": {"test": "community_admin"}})

    with pytest.raises(ResourceNotFoundError):
        FileGrantsPersistence(path).get("other", "ann@example.com")
    with pytest.raises(ResourceNotFoundError):
        FileGrantsPersistence(path).delete("test", "bob@example.com")


def test_replacing_keeps_the_binding(tmp_path: Path):
    ann = {"email": "ann@example.com", "issuer": ISSUER, "subject": "ann-sub", "grants": {"test": "community_admin"}}
    path = users_file(tmp_path, ann)

    replaced = FileGrantsPersistence(path).replace("test", "ann@example.com", grant())

    assert replaced.bound
    assert stored(path) == [ann]


def test_deleting_someones_last_grant_forgets_them(tmp_path: Path):
    path = users_file(tmp_path, {"email": "ann@example.com", "grants": {"test": "community_admin"}})

    FileGrantsPersistence(path).delete("test", "ann@example.com")

    assert stored(path) == []


def test_deleting_keeps_a_system_admin_listed(tmp_path: Path):
    path = users_file(
        tmp_path, {"email": "admin@example.com", "system_admin": True, "grants": {"test": "community_admin"}}
    )

    FileGrantsPersistence(path).delete("test", "admin@example.com")

    assert stored(path) == [{"email": "admin@example.com", "system_admin": True}]


def test_deleting_all_grants_in_a_community_leaves_the_others(tmp_path: Path):
    path = users_file(
        tmp_path,
        {"email": "ann@example.com", "grants": {"test": "community_admin", "other": "community_admin"}},
        {"email": "bob@example.com", "grants": {"test": "community_admin"}},
    )

    FileGrantsPersistence(path).delete_all("test")

    assert stored(path) == [{"email": "ann@example.com", "grants": {"other": "community_admin"}}]


# ── grants a client manages ───────────────────────────────────────────────

EDITOR = Role.community_editor
BOB = Account(issuer=ISSUER, subject="bob-sub")


def editor(email: str = "bob@example.com") -> Grant:
    return Grant(email=email, role=EDITOR)


def test_a_managed_grant_says_who_manages_it(tmp_path: Path):
    grants = FileGrantsPersistence(users_file(tmp_path))

    managed, skipped = grants.replace_managed("test", "energyid", [(editor(), None)])

    assert (managed, skipped) == ([Grant(email="bob@example.com", role=EDITOR, managed_by="energyid")], [])
    assert grants.all("test") == managed


def test_a_managed_grant_finds_its_account_by_subject_after_an_email_change(tmp_path: Path):
    path = users_file(
        tmp_path,
        {"email": "old@example.com", "issuer": ISSUER, "subject": "bob-sub", "grants": {"other": "community_admin"}},
    )

    FileGrantsPersistence(path).replace_managed("test", "energyid", [(editor("new@example.com"), BOB)])

    assert stored(path) == [
        {
            "email": "old@example.com",
            "issuer": ISSUER,
            "subject": "bob-sub",
            "grants": {"other": "community_admin", "test": "community_editor"},
            "managed_by": {"test": "energyid"},
        }
    ]


def test_a_managed_grant_skips_an_email_bound_to_another_account(tmp_path: Path):
    path = users_file(tmp_path, {"email": "bob@example.com", "issuer": ISSUER, "subject": "someone-else", "grants": {}})

    managed, skipped = FileGrantsPersistence(path).replace_managed("test", "energyid", [(editor(), BOB)])

    assert (managed, skipped) == ([], ["bob@example.com"])


def test_a_managed_grant_goes_to_an_unbound_email_without_binding_it(tmp_path: Path):
    path = users_file(tmp_path, {"email": "bob@example.com", "grants": {"other": "community_admin"}})

    FileGrantsPersistence(path).replace_managed("test", "energyid", [(editor(), BOB)])

    assert "subject" not in stored(path)[0]


def test_a_client_only_replaces_its_own_managed_grants(tmp_path: Path):
    path = users_file(
        tmp_path,
        {"email": "ann@example.com", "grants": {"test": "community_editor"}, "managed_by": {"test": "other-client"}},
    )
    grants = FileGrantsPersistence(path)

    assert grants.replace_managed("test", "energyid", [(editor("ann@example.com"), None)]) == ([], ["ann@example.com"])
    grants.replace_managed("test", "energyid", [])

    assert [grant.managed_by for grant in grants.all("test")] == ["other-client"]


def test_a_managed_grant_can_change_role(tmp_path: Path):
    grants = FileGrantsPersistence(users_file(tmp_path))
    grants.replace_managed("test", "energyid", [(editor(), None)])

    managed, _ = grants.replace_managed("test", "energyid", [(Grant(email="bob@example.com", role=ADMIN), None)])

    assert [grant.role for grant in managed] == [ADMIN]


def test_a_managed_grant_cannot_be_changed_or_revoked_one_by_one(tmp_path: Path):
    grants = FileGrantsPersistence(users_file(tmp_path))
    grants.replace_managed("test", "energyid", [(editor(), None)])

    with pytest.raises(ResourceManagedError, match="energyid"):
        grants.replace("test", "bob@example.com", Grant(email="bob@example.com", role=ADMIN))
    with pytest.raises(ResourceManagedError, match="energyid"):
        grants.delete("test", "bob@example.com")


def test_revoking_a_managed_grant_forgets_who_managed_it(tmp_path: Path):
    path = users_file(tmp_path, {"email": "bob@example.com", "grants": {"other": "community_admin"}})
    grants = FileGrantsPersistence(path)
    grants.replace_managed("test", "energyid", [(editor(), None)])

    grants.replace_managed("test", "energyid", [])

    assert stored(path) == [{"email": "bob@example.com", "grants": {"other": "community_admin"}}]


# ── grants to clients ─────────────────────────────────────────────────────


def with_clients(path: Path, *clients: dict) -> Path:
    users = yaml.safe_load(path.read_text())
    users["clients"] = list(clients)
    path.write_text(yaml.safe_dump(users))
    return path


def test_a_client_is_granted_a_role(tmp_path: Path):
    path = with_clients(users_file(tmp_path), client_record().model_dump(mode="json"))

    FileGrantsPersistence(path).grant_client("test", "energyid", Role.integration)

    assert yaml.safe_load(path.read_text())["clients"] == [
        {"name": "energyid", "hash": client_record().hash, "grants": {"test": "integration"}}
    ]


def test_an_unknown_client_is_not_granted_a_role(tmp_path: Path):
    with pytest.raises(ResourceNotFoundError, match="nobody"):
        FileGrantsPersistence(users_file(tmp_path)).grant_client("test", "nobody", Role.integration)


def test_deleting_every_grant_in_a_community_includes_the_clients(tmp_path: Path):
    record = client_record(grants={"test": Role.integration, "other": Role.integration})
    path = with_clients(users_file(tmp_path), record.model_dump(mode="json"))

    FileGrantsPersistence(path).delete_all("test")

    assert yaml.safe_load(path.read_text())["clients"][0]["grants"] == {"other": "integration"}
