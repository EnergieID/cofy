"""Integration tests for GrantsRouter, with the grants kept in the users file."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.management.api.grants import GrantsRouter, ManagedGrantsRouter
from cofy.management.auth.access import Role
from cofy.management.auth.session import install_session
from cofy.management.errors import EXCEPTION_HANDLERS
from cofy.management.persitance.file.communities import FileCommunitiesPersistence
from cofy.management.persitance.file.grants import FileGrantsPersistence

from ..access_fixture import ISSUER, OIDC_CONFIG, api_client, log_in, log_in_as_system_admin, user

GRANTS = "/management/communities/test/grants"
ANN = {"email": "ann@example.com", "issuer": ISSUER, "subject": "ann-sub", "grants": {"test": "community_admin"}}


@pytest.fixture()
def tmp_data(tmp_path: Path) -> Path:
    (tmp_path / "test.yaml").write_text(yaml.safe_dump({"type": "cofy_api"}))
    (tmp_path / "other.yaml").write_text(yaml.safe_dump({"type": "cofy_api"}))
    (tmp_path / "access").mkdir()
    (tmp_path / "access" / "users.yaml").write_text(yaml.safe_dump({"users": [ANN]}))
    return tmp_path


def app_for(tmp_data: Path) -> FastAPI:
    app = FastAPI(exception_handlers=EXCEPTION_HANDLERS)
    grants = FileGrantsPersistence(tmp_data / "access" / "users.yaml")
    app.include_router(GrantsRouter(grants, FileCommunitiesPersistence(tmp_data)).router)
    app.include_router(ManagedGrantsRouter(grants, FileCommunitiesPersistence(tmp_data)).router)
    return app


@pytest.fixture()
def client(tmp_data: Path) -> TestClient:
    app = app_for(tmp_data)
    log_in_as_system_admin(app)
    return TestClient(app, raise_server_exceptions=False)


def stored(tmp_data: Path) -> list[dict]:
    return yaml.safe_load((tmp_data / "access" / "users.yaml").read_text())["users"]


def test_lists_the_grants(client: TestClient):
    assert client.get(GRANTS).json() == [
        {"email": "ann@example.com", "role": "community_admin", "bound": True, "managed_by": None}
    ]


def test_granting_a_role_to_someone_new_adds_them_unbound(client: TestClient, tmp_data: Path):
    r = client.post(GRANTS, json={"email": "bob@example.com", "role": "community_admin"})

    assert r.status_code == 201
    assert r.json() == {"email": "bob@example.com", "role": "community_admin", "bound": False, "managed_by": None}
    assert stored(tmp_data)[1] == {"email": "bob@example.com", "grants": {"test": "community_admin"}}


def test_granting_a_role_in_another_community_adds_it_to_the_same_person(client: TestClient, tmp_data: Path):
    client.post("/management/communities/other/grants", json={"email": "ANN@example.com", "role": "community_admin"})

    assert stored(tmp_data) == [ANN | {"grants": {"test": "community_admin", "other": "community_admin"}}]


def test_a_person_can_only_have_one_role_in_a_community(client: TestClient):
    assert client.post(GRANTS, json={"email": "ANN@example.com", "role": "community_admin"}).status_code == 409


def test_a_grant_needs_a_valid_email(client: TestClient):
    assert client.post(GRANTS, json={"email": "not-an-email", "role": "community_admin"}).status_code == 422


def test_a_client_cannot_bind_a_grant(client: TestClient, tmp_data: Path):
    client.post(GRANTS, json={"email": "bob@example.com", "role": "community_admin", "subject": "forged"})

    assert "subject" not in stored(tmp_data)[1]


def test_changing_a_role_keeps_the_binding(client: TestClient, tmp_data: Path):
    r = client.put(f"{GRANTS}/ann@example.com", json={"email": "ann@example.com", "role": "community_admin"})

    assert r.status_code == 200
    assert stored(tmp_data) == [ANN]


def test_changing_cannot_move_a_grant_to_someone_else(client: TestClient):
    r = client.put(f"{GRANTS}/ann@example.com", json={"email": "eve@example.com", "role": "community_admin"})

    assert r.status_code == 422


def test_revoking_someones_last_role_forgets_them(client: TestClient, tmp_data: Path):
    assert client.delete(f"{GRANTS}/ann@example.com").status_code == 204
    assert stored(tmp_data) == []


def test_an_unknown_grant_returns_404(client: TestClient):
    assert client.get(f"{GRANTS}/nobody@example.com").status_code == 404


def test_grants_in_a_community_that_does_not_exist_return_404(client: TestClient):
    assert client.get("/management/communities/missing/grants").status_code == 404
    r = client.post(
        "/management/communities/missing/grants", json={"email": "bob@example.com", "role": "community_admin"}
    )
    assert r.status_code == 404


# ── who may manage grants ─────────────────────────────────────────────────


def test_a_community_admin_manages_their_own_communitys_grants(tmp_data: Path):
    app = app_for(tmp_data)
    log_in(app, user("ann", grants={"test": Role.community_admin}))
    client = TestClient(app)

    assert client.post(GRANTS, json={"email": "bob@example.com", "role": "community_admin"}).status_code == 201
    assert client.get("/management/communities/other/grants").status_code == 403


def test_grants_are_not_reachable_without_a_login(tmp_data: Path):
    app = app_for(tmp_data)
    install_session(app, OIDC_CONFIG)

    r = TestClient(app, raise_server_exceptions=False).get(GRANTS)

    assert r.status_code == 401
    assert r.json()["code"] == "not-authenticated"


def test_a_broken_users_file_is_reported_without_its_contents(client: TestClient, tmp_data: Path):
    (tmp_data / "access" / "users.yaml").write_text(
        yaml.safe_dump({"users": [{"email": "ann@example.com"}, {"email": "ann@example.com"}]})
    )

    r = client.get(GRANTS)

    assert r.status_code == 500
    assert r.json()["code"] == "stored-data-invalid"
    assert "ann@example.com" not in r.text
    assert "users.yaml" not in r.text


# ── Grants a client manages ───────────────────────────────────────────────

MANAGED = "/management/communities/test/managed-grants"
EDITOR = "community_editor"


def as_client(tmp_data: Path) -> TestClient:
    app = app_for(tmp_data)
    log_in(app, api_client(grants={"test": Role.integration}))
    return TestClient(app, raise_server_exceptions=False)


def test_a_client_grants_whom_it_lists(tmp_data: Path):
    r = as_client(tmp_data).put(MANAGED, json=[{"email": "bob@example.com", "role": EDITOR}])

    assert r.status_code == 200
    assert r.json() == {
        "grants": [{"email": "bob@example.com", "role": EDITOR, "bound": False, "managed_by": "energyid"}],
        "skipped": [],
    }


def test_a_managed_grant_is_tied_to_an_account_only_by_a_login(tmp_data: Path):
    as_client(tmp_data).put(MANAGED, json=[{"email": "bob@example.com", "role": EDITOR, "subject": "forged"}])

    assert "subject" not in stored(tmp_data)[-1]


def test_a_client_revokes_whom_it_no_longer_lists(tmp_data: Path):
    client = as_client(tmp_data)
    client.put(MANAGED, json=[{"email": "bob@example.com", "role": EDITOR}])

    r = client.put(MANAGED, json=[])

    assert r.json() == {"grants": [], "skipped": []}
    assert [person["email"] for person in stored(tmp_data)] == ["ann@example.com"]


def test_a_client_leaves_a_grant_it_does_not_manage(tmp_data: Path):
    r = as_client(tmp_data).put(MANAGED, json=[{"email": "ann@example.com", "role": EDITOR}])

    assert r.json() == {"grants": [], "skipped": ["ann@example.com"]}
    assert stored(tmp_data) == [ANN]


def test_a_client_lists_each_person_once(tmp_data: Path):
    grants = [{"email": "bob@example.com", "role": EDITOR}, {"email": "BOB@example.com", "role": EDITOR}]

    assert as_client(tmp_data).put(MANAGED, json=grants).status_code == 422


def test_a_client_does_not_grant_its_own_role_to_people(tmp_data: Path):
    r = as_client(tmp_data).put(MANAGED, json=[{"email": "bob@example.com", "role": "integration"}])

    assert r.status_code == 422


def test_a_client_manages_grants_only_where_it_looks_after_the_community(tmp_data: Path):
    app = app_for(tmp_data)
    log_in(app, api_client(grants={"other": Role.integration}))

    r = TestClient(app, raise_server_exceptions=False).put(MANAGED, json=[])

    assert r.status_code == 403


def test_a_client_only_manages_grants_as_a_whole(tmp_data: Path):
    client = as_client(tmp_data)

    assert client.get(GRANTS).status_code == 200
    assert client.post(GRANTS, json={"email": "bob@example.com", "role": EDITOR}).status_code == 403
    assert client.put(f"{GRANTS}/ann@example.com", json={"email": "ann@example.com", "role": EDITOR}).status_code == 403
    assert client.delete(f"{GRANTS}/ann@example.com").status_code == 403


def test_only_a_client_manages_grants(client: TestClient, tmp_data: Path):
    app = app_for(tmp_data)
    log_in(app, user("ann", grants={"test": Role.community_admin}))
    community_admin = TestClient(app, raise_server_exceptions=False)

    assert client.put(MANAGED, json=[]).status_code == 403
    assert community_admin.put(MANAGED, json=[]).status_code == 403


def test_people_cannot_change_a_grant_a_client_manages(client: TestClient, tmp_data: Path):
    as_client(tmp_data).put(MANAGED, json=[{"email": "bob@example.com", "role": EDITOR}])

    changed = client.put(f"{GRANTS}/bob@example.com", json={"email": "bob@example.com", "role": "community_admin"})
    revoked = client.delete(f"{GRANTS}/bob@example.com")

    assert (changed.status_code, changed.json()["code"]) == (409, "resource-managed")
    assert (revoked.status_code, revoked.json()["code"]) == (409, "resource-managed")


def test_people_cannot_grant_the_role_of_clients(client: TestClient):
    r = client.post(GRANTS, json={"email": "bob@example.com", "role": "integration"})

    assert r.status_code == 422
