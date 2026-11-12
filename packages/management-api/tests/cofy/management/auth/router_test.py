"""Logging in and out, with the identity provider's side of the exchange stood in for."""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.management.auth.access import Role
from cofy.management.auth.config import OidcConfig
from cofy.management.auth.router import AuthRouter, safe_return_to
from cofy.management.auth.session import install_session
from cofy.management.auth.user import install_users
from cofy.management.errors import EXCEPTION_HANDLERS
from cofy.management.persitance.file.communities import FileCommunitiesPersistence
from cofy.management.persitance.file.users import FileUsersPersistence
from cofy.management.proxied import ProxiedUrls

from ..access_fixture import ISSUER, OIDC_CONFIG, client_record

METADATA = {
    "issuer": ISSUER,
    "authorization_endpoint": f"{ISSUER}/connect/authorize",
    "token_endpoint": f"{ISSUER}/connect/token",
    "end_session_endpoint": f"{ISSUER}/connect/endsession",
    "userinfo_endpoint": f"{ISSUER}/connect/userinfo",
}
ANN = {
    "issuer": ISSUER,
    "subject": "ann-sub",
    "email": "ann@example.com",
    "name": "Ann",
    "system_admin": False,
    "permissions": [
        {
            "slug": "test",
            "permissions": [
                {"action": action, "subject": subject}
                for subject in (
                    "community",
                    "modules",
                    "resources",
                    "secrets",
                    "tokens",
                    "grants",
                    "allowed_types",
                )
                for action in ("create", "read", "update", "delete")
                if action == "read" or not (subject == "community" or subject.startswith("allowed_"))
            ],
        },
    ],
}
CLAIMS = {"iss": ISSUER, "sub": "ann-sub", "email": "ann@example.com", "email_verified": True, "name": "Ann"}


@pytest.fixture()
def data(tmp_path: Path) -> Path:
    (tmp_path / "test.yaml").write_text(yaml.safe_dump({"type": "cofy_api"}))
    # Apart from the communities, as in the data directory, or it would be listed as one.
    (tmp_path / "access").mkdir()
    users = [
        {"email": "ann@example.com", "grants": {"test": "community_admin"}},
        {"email": "root@example.com", "system_admin": True},
    ]
    (tmp_path / "access" / "users.yaml").write_text(yaml.safe_dump({"users": users}))
    return tmp_path


def stored_user(data: Path, email: str) -> dict:
    return next(u for u in yaml.safe_load((data / "access" / "users.yaml").read_text())["users"] if u["email"] == email)


def client_for(
    data: Path,
    monkeypatch: pytest.MonkeyPatch,
    config: OidcConfig = OIDC_CONFIG,
    metadata: dict | Exception = METADATA,
    userinfo: dict | None = None,
    **claims: Any,
) -> TestClient:
    users = FileUsersPersistence(data / "access" / "users.yaml")
    router = AuthRouter(config, users, FileCommunitiesPersistence(data))

    async def load_server_metadata() -> dict:
        if isinstance(metadata, Exception):
            raise metadata
        return metadata

    async def authorize_access_token(request) -> dict:
        return {"userinfo": CLAIMS | claims, "id_token": "the-id-token"}

    monkeypatch.setattr(router.client, "load_server_metadata", load_server_metadata)

    async def fetch_userinfo(token: dict) -> dict:
        assert userinfo is not None, "the userinfo endpoint was not expected to be asked"
        return userinfo

    monkeypatch.setattr(router.client, "authorize_access_token", authorize_access_token)
    monkeypatch.setattr(router.client, "userinfo", fetch_userinfo)

    app = FastAPI(exception_handlers=EXCEPTION_HANDLERS)
    install_session(app, OIDC_CONFIG)
    install_users(app, users)
    app.include_router(router.router)
    app.state.auth_client = router.client
    return TestClient(app, raise_server_exceptions=False, follow_redirects=False)


def log_in(client: TestClient, return_to: str = "/#/communities/test"):
    client.get("/auth/login", params={"return_to": return_to})
    return client.get("/auth/callback")


# ── login ─────────────────────────────────────────────────────────────────


def test_login_sends_the_browser_to_the_identity_provider_with_pkce(data: Path, monkeypatch: pytest.MonkeyPatch):
    r = client_for(data, monkeypatch).get("/auth/login")

    assert r.status_code == 302
    location = urlparse(r.headers["location"])
    query = parse_qs(location.query)
    assert f"{location.scheme}://{location.netloc}{location.path}" == METADATA["authorization_endpoint"]
    assert query["client_id"] == ["cofy-management"]
    assert query["redirect_uri"] == ["http://testserver/auth/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["scope"] == ["openid profile email"]


def test_the_callback_logs_in_and_returns_to_where_the_login_started(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch)

    r = log_in(client)

    assert r.status_code == 303
    assert r.headers["location"] == "/#/communities/test"
    assert client.get("/auth/me").json() == ANN


def test_the_session_cookie_is_http_only_and_same_site(data: Path, monkeypatch: pytest.MonkeyPatch):
    cookie = log_in(client_for(data, monkeypatch)).headers["set-cookie"].lower()

    assert "httponly" in cookie
    assert "samesite=lax" in cookie


def test_the_login_binds_the_waiting_grants(data: Path, monkeypatch: pytest.MonkeyPatch):
    log_in(client_for(data, monkeypatch))

    ann = stored_user(data, "ann@example.com")
    assert (ann["issuer"], ann["subject"]) == (ISSUER, "ann-sub")


def test_me_reports_no_community_to_someone_without_grants(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch, sub="eve-sub", email="eve@example.com")

    log_in(client)

    assert client.get("/auth/me").json()["permissions"] == []


def test_the_login_binds_a_system_admin(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch, sub="root-sub", email="root@example.com")

    log_in(client)

    me = client.get("/auth/me").json()
    assert me["system_admin"]
    assert [entry["slug"] for entry in me["permissions"]] == [None, "test"]
    assert all(len(entry["permissions"]) == 32 for entry in me["permissions"])
    assert stored_user(data, "root@example.com")["subject"] == "root-sub"


def test_an_unverified_email_is_logged_in_but_not_bound(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch, email_verified=False)

    log_in(client)

    assert client.get("/auth/me").status_code == 200
    assert "subject" not in stored_user(data, "ann@example.com")


def test_an_email_missing_from_the_id_token_is_taken_from_userinfo(data: Path, monkeypatch: pytest.MonkeyPatch):
    userinfo = {"sub": "ann-sub", "email": "ann@example.com", "email_verified": "true", "name": "Ann"}
    client = client_for(data, monkeypatch, userinfo=userinfo)

    async def authorize_access_token(request) -> dict:
        return {"userinfo": {"iss": ISSUER, "sub": "ann-sub"}, "id_token": "the-id-token"}

    monkeypatch.setattr(client.app.state.auth_client, "authorize_access_token", authorize_access_token)

    log_in(client)

    assert client.get("/auth/me").json() == ANN


def test_userinfo_about_someone_else_is_ignored(data: Path, monkeypatch: pytest.MonkeyPatch):
    userinfo = {"sub": "eve-sub", "email": "eve@example.com", "email_verified": True}
    client = client_for(data, monkeypatch, userinfo=userinfo)

    async def authorize_access_token(request) -> dict:
        return {"userinfo": {"iss": ISSUER, "sub": "ann-sub"}, "id_token": "the-id-token"}

    monkeypatch.setattr(client.app.state.auth_client, "authorize_access_token", authorize_access_token)

    log_in(client)

    assert client.get("/auth/me").json()["email"] is None


@pytest.mark.parametrize(
    "return_to", ["https://evil.example/", "//evil.example/", "/\\evil.example", "javascript:alert(1)", ""]
)
def test_a_login_only_returns_to_this_site(return_to: str):
    assert safe_return_to(return_to) == "/"


def test_a_path_on_this_site_is_returned_to():
    assert safe_return_to("/#/communities/test") == "/#/communities/test"


# ── the session ───────────────────────────────────────────────────────────


def test_without_a_login_me_is_401(data: Path, monkeypatch: pytest.MonkeyPatch):
    r = client_for(data, monkeypatch).get("/auth/me")

    assert r.status_code == 401
    assert r.json()["code"] == "not-authenticated"


def test_a_session_ends_when_its_lifetime_is_up_even_while_in_use(data: Path, monkeypatch: pytest.MonkeyPatch):
    # Already over when it starts, while the cookie itself would still be kept for hours.
    expired = OIDC_CONFIG.model_copy(update={"session_lifetime": dt.timedelta(seconds=-1)})
    client = client_for(data, monkeypatch, expired)

    log_in(client)

    assert client.get("/auth/me").status_code == 401


# ── logout ────────────────────────────────────────────────────────────────


def test_logout_ends_the_session_and_the_identity_providers(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch)
    log_in(client)

    r = client.post("/auth/logout")

    assert r.status_code == 303
    location = urlparse(r.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == METADATA["end_session_endpoint"]
    assert parse_qs(location.query)["id_token_hint"] == ["the-id-token"]
    assert client.get("/auth/me").status_code == 401


def test_logout_stays_here_when_the_identity_provider_has_no_end_session(data: Path, monkeypatch: pytest.MonkeyPatch):
    metadata = {key: value for key, value in METADATA.items() if key != "end_session_endpoint"}
    client = client_for(data, monkeypatch, metadata=metadata)

    assert client.post("/auth/logout").headers["location"] == "/"


def test_logout_ends_the_session_here_when_the_identity_provider_cannot_be_reached(
    data: Path, monkeypatch: pytest.MonkeyPatch
):
    client = client_for(data, monkeypatch)
    log_in(client)
    monkeypatch.setattr(client.app.state.auth_client, "load_server_metadata", _timing_out)

    r = client.post("/auth/logout")

    assert (r.status_code, r.headers["location"]) == (303, "/")
    assert client.get("/auth/me").status_code == 401


async def _timing_out() -> dict:
    raise httpx.ReadTimeout("the identity provider took too long")


# ── clients ───────────────────────────────────────────────────────────────


def with_client(data: Path) -> None:
    users = yaml.safe_load((data / "access" / "users.yaml").read_text())
    users["clients"] = [client_record(grants={"test": Role.integration}).model_dump(mode="json")]
    (data / "access" / "users.yaml").write_text(yaml.safe_dump(users))


def test_a_client_is_known_by_its_api_key(data: Path, monkeypatch: pytest.MonkeyPatch):
    with_client(data)

    r = client_for(data, monkeypatch).get("/auth/me", headers={"Authorization": "Bearer energyid-key"})

    assert r.json() == {
        "issuer": None,
        "subject": None,
        "email": None,
        "name": "energyid",
        "system_admin": False,
        "permissions": [
            {
                "slug": "test",
                "permissions": [
                    {"action": "read", "subject": "community"},
                    {"action": "create", "subject": "tokens"},
                    {"action": "read", "subject": "tokens"},
                    {"action": "update", "subject": "tokens"},
                    {"action": "delete", "subject": "tokens"},
                    {"action": "read", "subject": "grants"},
                    {"action": "update", "subject": "managed_grants"},
                ],
            }
        ],
    }


@pytest.mark.parametrize("authorization", ["Bearer someone-else", "energyid-key", "Basic energyid-key", "Bearer "])
def test_an_unknown_or_malformed_api_key_is_refused(data: Path, monkeypatch: pytest.MonkeyPatch, authorization: str):
    with_client(data)

    r = client_for(data, monkeypatch).get("/auth/me", headers={"Authorization": authorization})

    assert r.status_code == 401


def test_an_api_key_is_asked_for_instead_of_the_session(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = client_for(data, monkeypatch)
    log_in(client)

    assert client.get("/auth/me", headers={"Authorization": "Bearer someone-else"}).status_code == 401


# ── behind a proxy ────────────────────────────────────────────────────────


def proxied(client: TestClient, url: str = "https://app.example/cofy") -> TestClient:
    client.app.add_middleware(ProxiedUrls, urls=[url])
    return client


def test_a_login_through_a_proxy_comes_back_through_it(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = proxied(client_for(data, monkeypatch))

    r = client.get("/auth/login", headers={"X-Forwarded-Prefix": "/cofy"})

    redirect_uri = parse_qs(urlparse(r.headers["location"]).query)["redirect_uri"]
    assert redirect_uri == ["https://app.example/cofy/auth/callback"]


def test_a_proxy_may_leave_its_prefix_on_the_path(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = proxied(client_for(data, monkeypatch))

    r = client.get("/cofy/auth/login", headers={"X-Forwarded-Prefix": "/cofy/"})

    redirect_uri = parse_qs(urlparse(r.headers["location"]).query)["redirect_uri"]
    assert redirect_uri == ["https://app.example/cofy/auth/callback"]


def test_a_login_through_an_unknown_proxy_comes_back_here(data: Path, monkeypatch: pytest.MonkeyPatch):
    client = proxied(client_for(data, monkeypatch))

    r = client.get("/auth/login", headers={"X-Forwarded-Prefix": "/elsewhere"})

    assert parse_qs(urlparse(r.headers["location"]).query)["redirect_uri"] == ["http://testserver/auth/callback"]
