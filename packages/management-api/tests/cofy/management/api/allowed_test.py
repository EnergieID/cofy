"""Integration tests for restricting which module types and resource types communities may configure."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from cofy.api.json_schema import NEVER
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.management.api.allowed import AllowedTypesRouter
from cofy.management.api.community_allowed_types import CommunityAllowedTypesRouter
from cofy.management.api.modules import ModulesRouter
from cofy.management.api.resources import ResourcesRouter
from cofy.management.auth.access import Role
from cofy.management.errors import add_exception_handlers
from cofy.management.persitance.file.communities import FileCommunitiesPersistence
from cofy.management.persitance.file.modules import FileModulesPersistence
from cofy.management.persitance.file.resources import FileResourcesPersistence

from ..access_fixture import log_in, log_in_as_system_admin, user
from ..allowed_fixture import allowed_in, include_catalogs
from .community_fixture import ref, write_community

COMMUNITY = "/management/communities/test"
ENTSOE = {"type": "entsoe_day_ahead", "api_key": {"type": "secret", "name": "entsoe_key"}}


@pytest.fixture()
def tmp_data(tmp_path: Path) -> Path:
    write_community(tmp_path)
    (tmp_path / "other.yaml").write_text(yaml.safe_dump({"type": "cofy_api"}))
    return tmp_path


def app_for(tmp_data: Path) -> FastAPI:
    app = FastAPI()
    add_exception_handlers(app)
    allowed = allowed_in(tmp_data)
    modules, resources = FileModulesPersistence(tmp_data), FileResourcesPersistence(tmp_data)
    app.include_router(AllowedTypesRouter(allowed, FileCommunitiesPersistence(tmp_data)).router)
    app.include_router(CommunityAllowedTypesRouter(allowed, FileCommunitiesPersistence(tmp_data)).router)
    include_catalogs(app, allowed)
    app.include_router(ModulesRouter(modules, allowed).router)
    app.include_router(ResourcesRouter(resources, modules, allowed).router)
    return app


@pytest.fixture()
def client(tmp_data: Path) -> TestClient:
    app = app_for(tmp_data)
    log_in_as_system_admin(app)
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def community_admin(tmp_data: Path) -> TestClient:
    app = app_for(tmp_data)
    log_in(app, user("ann", grants={"test": Role.community_admin}))
    return TestClient(app, raise_server_exceptions=False)


def stored(tmp_data: Path) -> dict:
    return yaml.safe_load((tmp_data / "access" / "allowed.yaml").read_text())


def types(client: TestClient, path: str) -> list[str]:
    return [entry["type"] for entry in client.get(path).json()]


def schema_of(client: TestClient, module_type: str, slug: str = "test") -> dict:
    catalog = client.get(f"/management/communities/{slug}/catalog/modules").json()
    return next(entry for entry in catalog if entry["type"] == module_type)["schema"]


def disallow(client: TestClient, group: str, name: str, slug: str = "test") -> None:
    r = client.put(f"/management/allowed-types/{group}/{name}", json={"default": True, "exceptions": [slug]})
    assert r.status_code == 200, r.text


# ── availability ──────────────────────────────────────────────────────────


def test_an_unrestricted_type_is_allowed_everywhere(client: TestClient):
    assert "billing" in types(client, f"{COMMUNITY}/catalog/modules")


def test_lists_every_module_type_with_its_availability(client: TestClient):
    billing = next(entry for entry in client.get("/management/allowed-types").json() if entry["type"] == "billing")

    assert billing == {
        "group": "module",
        "type": "billing",
        "description": billing["description"],
        "default": True,
        "exceptions": [],
    }


def test_lists_each_type_of_source_in_place_of_the_source_kind(client: TestClient):
    entries = {(entry["group"], entry["type"]): entry for entry in client.get("/management/allowed-types").json()}

    assert ("resource", "source") not in entries
    assert (
        entries[("source", "entsoe_day_ahead")]["description"]
        == "Day-ahead electricity prices of a bidding zone, from ENTSO-E."
    )
    assert entries[("resource", "tariff")]["description"] == "An energy cost tariff."
    assert {("source", "energyid_production"), ("source", "acc_forecast")} <= set(entries)
    assert list(entries)[0][0] == "module"


def test_replacing_an_availability(client: TestClient, tmp_data: Path):
    r = client.put("/management/allowed-types/module/billing", json={"default": False, "exceptions": ["other"]})

    assert r.status_code == 200
    assert r.json()["exceptions"] == ["other"]
    assert "billing" not in types(client, f"{COMMUNITY}/catalog/modules")
    assert "billing" in types(client, "/management/communities/other/catalog/modules")
    assert stored(tmp_data)["module"] == {"billing": {"default": False, "exceptions": ["other"]}}


def test_an_exception_must_be_a_community(client: TestClient, tmp_data: Path):
    r = client.put("/management/allowed-types/module/billing", json={"default": False, "exceptions": ["missing"]})

    assert r.status_code == 422
    assert not (tmp_data / "access" / "allowed.yaml").exists()


@pytest.mark.parametrize(
    "path", ["/management/allowed-types/module/nonexistent", "/management/allowed-types/resource/source"]
)
def test_replacing_the_availability_of_an_unknown_type_is_not_found(client: TestClient, path: str):
    assert client.put(path, json={"default": False}).status_code == 404


# ── one community's view ─────────────────────────────────────────────────


def allowed_to(client: TestClient, slug: str = "test") -> dict[tuple[str, str], bool]:
    entries = client.get(f"/management/communities/{slug}/allowed-types").json()
    return {(entry["group"], entry["type"]): entry["allowed"] for entry in entries}


def test_lists_every_type_with_whether_a_community_may_use_it(client: TestClient):
    disallow(client, "source", "entsoe_day_ahead")

    allowed = allowed_to(client)

    assert allowed[("source", "entsoe_day_ahead")] is False
    assert allowed[("module", "billing")] is True
    assert allowed_to(client, "other")[("source", "entsoe_day_ahead")] is True


@pytest.mark.parametrize(
    ("availability", "allowed", "stored_as"),
    [
        ({"default": True}, False, {"default": True, "exceptions": ["test"]}),
        ({"default": True, "exceptions": ["test"]}, True, None),
        ({"default": False}, True, {"default": False, "exceptions": ["test"]}),
        ({"default": False, "exceptions": ["other", "test"]}, False, {"default": False, "exceptions": ["other"]}),
    ],
)
def test_allowing_a_type_to_a_community_keeps_its_default(
    client: TestClient, tmp_data: Path, availability: dict, allowed: bool, stored_as: dict | None
):
    client.put("/management/allowed-types/module/billing", json=availability)

    r = client.put(f"{COMMUNITY}/allowed-types/module/billing", json={"allowed": allowed})

    assert r.status_code == 200
    assert r.json() == {
        "group": "module",
        "type": "billing",
        "description": r.json()["description"],
        "allowed": allowed,
    }
    assert stored(tmp_data).get("module", {}).get("billing") == stored_as


def test_allowing_a_type_to_one_community_loses_no_change_for_another(client: TestClient):
    """What a client last saw doesn't matter: each community's change is made on what is stored."""
    client.put(f"{COMMUNITY}/allowed-types/module/billing", json={"allowed": False})
    client.put("/management/communities/other/allowed-types/module/billing", json={"allowed": False})

    assert allowed_to(client)[("module", "billing")] is False
    assert allowed_to(client, "other")[("module", "billing")] is False


@pytest.mark.parametrize(
    "path",
    [f"{COMMUNITY}/allowed-types/module/nonexistent", "/management/communities/missing/allowed-types/module/billing"],
)
def test_allowing_an_unknown_type_or_to_an_unknown_community_is_not_found(client: TestClient, path: str):
    assert client.put(path, json={"allowed": False}).status_code == 404


# ── who may ───────────────────────────────────────────────────────────────


def test_a_community_admin_sees_what_their_community_may_use(community_admin: TestClient):
    assert community_admin.get(f"{COMMUNITY}/allowed-types").status_code == 200


def test_a_community_admin_sees_what_their_community_may_configure(community_admin: TestClient):
    assert community_admin.get(f"{COMMUNITY}/catalog/modules").status_code == 200
    assert community_admin.get(f"{COMMUNITY}/catalog/resources").status_code == 200


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/management/allowed-types"),
        ("put", "/management/allowed-types/module/billing"),
        ("put", "/management/allowed-types/resource/tariff"),
        ("put", f"{COMMUNITY}/allowed-types/module/billing"),
    ],
)
def test_only_a_system_admin_restricts_types(community_admin: TestClient, method: str, path: str):
    body = {"json": {"default": False, "allowed": False}} if method == "put" else {}

    assert community_admin.request(method, path, **body).status_code == 403


# ── what a community may configure ────────────────────────────────────────


def test_a_module_of_a_disallowed_type_can_still_be_deleted(client: TestClient):
    disallow(client, "module", "tariff")

    module = {"type": "tariff", "name": "spot", "source": ref("day_ahead")}
    assert client.put(f"{COMMUNITY}/modules/tariff/spot", json=module).status_code == 422
    assert client.delete(f"{COMMUNITY}/modules/tariff/spot").status_code == 204


def test_a_disallowed_resource_type_cant_be_given_inline(client: TestClient):
    disallow(client, "resource", "tariff")

    tariff = [{"start": "2024-01-01T00:00:00+01:00", "consumption": {"constant_cost": 10.0}}]
    r = client.post(
        f"{COMMUNITY}/modules",
        json={"type": "tariff", "name": "costs", "source": {"type": "energy_cost", "tariff": tariff}},
    )

    assert r.status_code == 422
    assert "'tariff' is not allowed for community 'test'" in r.json()["detail"]


def test_a_disallowed_source_type_cant_be_given_inline(client: TestClient):
    disallow(client, "source", "entsoe_day_ahead")

    r = client.post(f"{COMMUNITY}/modules", json={"type": "tariff", "name": "inline", "source": ENTSOE})

    assert r.status_code == 422
    assert "'entsoe_day_ahead' is not allowed for community 'test'" in r.json()["detail"]


def test_a_disallowed_source_type_cant_be_held_by_a_resource(client: TestClient):
    disallow(client, "source", "entsoe_day_ahead")

    r = client.post(f"{COMMUNITY}/resources", json={"type": "source", "name": "new", "value": ENTSOE})

    assert r.status_code == 422


def test_a_resource_holding_a_disallowed_source_type_can_still_be_referenced(client: TestClient):
    disallow(client, "source", "entsoe_day_ahead")

    r = client.post(f"{COMMUNITY}/modules", json={"type": "tariff", "name": "referenced", "source": ref("day_ahead")})

    assert r.status_code == 201


def test_the_source_kind_is_configurable_while_one_of_its_types_is(client: TestClient):
    for entry in client.get("/management/allowed-types").json():
        if entry["group"] == "source" and entry["type"] != "entsoe_day_ahead":
            disallow(client, "source", entry["type"])

    assert types(client, f"{COMMUNITY}/catalog/resources") == ["source", "tariff"]
    disallow(client, "source", "entsoe_day_ahead")
    assert types(client, f"{COMMUNITY}/catalog/resources") == ["tariff"]


def test_the_schema_accepts_none_of_the_source_types_a_community_may_not_use(client: TestClient):
    disallow(client, "source", "entsoe_day_ahead")

    here, elsewhere = schema_of(client, "tariff")["$defs"], schema_of(client, "tariff", "other")["$defs"]

    assert here["EntsoeDayAheadTariffSourceSettings"] == NEVER
    assert here["EnergyCostTariffSourceSettings"] != NEVER
    assert elsewhere["EntsoeDayAheadTariffSourceSettings"] != NEVER


def test_the_schema_accepts_no_value_of_a_kind_a_community_may_not_use(client: TestClient):
    disallow(client, "resource", "tariff")

    assert schema_of(client, "tariff")["$defs"]["Tariff"] == NEVER
    assert schema_of(client, "tariff", "other")["$defs"]["Tariff"] != NEVER
