"""Logging in with the access token of an app embedding the console, with the identity provider stood in for."""

from __future__ import annotations

import base64
import json
import secrets
import time
from pathlib import Path
from typing import Any

import httpx
import pytest
import yaml

from cofy.management.auth.host_tokens import HostTokens

from ..access_fixture import ISSUER, OIDC_CONFIG
from .router_test import client_for, log_in, stored_user, with_client

HOST = "EnergyID-WebApp"
CONFIG = OIDC_CONFIG.model_copy(update={"host_clients": [HOST]})


class Provider:
    """The identity provider's side: its discovery document, and a userinfo endpoint answering for the tokens it
    issued that haven't expired."""

    def __init__(self) -> None:
        self.issued: set[str] = set()
        self.userinfo: dict[str, Any] = {"sub": "ann-sub", "email": "ann@example.com", "email_verified": True}
        self.userinfo_calls = 0

    def token(self, *, issued: bool = True, **claims: Any) -> str:
        """An access token for Ann, issued to the app - unless *issued* is false: then only made to look like one."""
        now = int(time.time())
        payload = {"iss": ISSUER, "sub": "ann-sub", "client_id": HOST, "exp": now + 3600} | claims
        token = ".".join(
            base64.urlsafe_b64encode(json.dumps(part).encode()).decode().rstrip("=")
            for part in ({"alg": "RS256", "typ": "at+jwt"}, payload)
        )
        token = f"{token}.{secrets.token_urlsafe(16)}"
        if issued:
            self.issued.add(token)
        return token

    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/.well-known/openid-configuration":
            return httpx.Response(200, json={"issuer": ISSUER, "userinfo_endpoint": f"{ISSUER}/userinfo"})
        if request.url.path == "/userinfo":
            self.userinfo_calls += 1
            token = request.headers["Authorization"].removeprefix("Bearer ")
            payload = token.split(".")[1]
            expired = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["exp"] < time.time()
            if token not in self.issued or expired:
                return httpx.Response(401)
            return httpx.Response(200, json=self.userinfo)
        return httpx.Response(404)


@pytest.fixture()
def data(tmp_path: Path) -> Path:
    (tmp_path / "test.yaml").write_text(yaml.safe_dump({"type": "cofy_api"}))
    (tmp_path / "access").mkdir()
    users = [{"email": "ann@example.com", "grants": {"test": "community_admin"}}]
    (tmp_path / "access" / "users.yaml").write_text(yaml.safe_dump({"users": users}))
    return tmp_path


@pytest.fixture()
def provider() -> Provider:
    return Provider()


def client(data: Path, monkeypatch: pytest.MonkeyPatch, provider: Provider):
    tokens = HostTokens(CONFIG, httpx.AsyncClient(transport=httpx.MockTransport(provider.handle)))
    return client_for(data, monkeypatch, host_tokens=tokens)


def me(api, token: str) -> httpx.Response:
    return api.get("/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_a_token_of_a_listed_app_logs_in_whom_it_was_issued_to(data: Path, monkeypatch, provider: Provider):
    r = me(client(data, monkeypatch, provider), provider.token())

    assert r.status_code == 200
    assert r.json()["email"] == "ann@example.com"
    assert [entry["slug"] for entry in r.json()["permissions"]] == ["test"]


def test_a_first_token_binds_what_was_granted_to_the_email(data: Path, monkeypatch, provider: Provider):
    me(client(data, monkeypatch, provider), provider.token())

    assert stored_user(data, "ann@example.com")["subject"] == "ann-sub"


def test_the_identity_provider_is_asked_once_per_token(data: Path, monkeypatch, provider: Provider):
    api = client(data, monkeypatch, provider)
    token = provider.token()

    me(api, token)
    me(api, token)

    assert provider.userinfo_calls == 1


def test_a_token_of_another_app_is_refused_without_asking(data: Path, monkeypatch, provider: Provider):
    r = me(client(data, monkeypatch, provider), provider.token(client_id="someone-else"))

    assert r.status_code == 401
    assert provider.userinfo_calls == 0


def test_a_token_of_another_identity_provider_is_refused_without_asking(data: Path, monkeypatch, provider: Provider):
    r = me(client(data, monkeypatch, provider), provider.token(iss="https://elsewhere.example"))

    assert r.status_code == 401
    assert provider.userinfo_calls == 0


def test_a_token_the_identity_provider_did_not_issue_is_refused(data: Path, monkeypatch, provider: Provider):
    r = me(client(data, monkeypatch, provider), provider.token(issued=False))

    assert r.status_code == 401


def test_an_expired_token_is_refused_even_beside_a_login(data: Path, monkeypatch, provider: Provider):
    api = client(data, monkeypatch, provider)
    log_in(api)

    r = me(api, provider.token(exp=int(time.time()) - 60))

    assert r.status_code == 401


def test_a_userinfo_answer_about_someone_else_is_refused(data: Path, monkeypatch, provider: Provider):
    provider.userinfo = {"sub": "bob-sub", "email": "ann@example.com", "email_verified": True}

    r = me(client(data, monkeypatch, provider), provider.token())

    assert r.status_code == 401
    assert "subject" not in stored_user(data, "ann@example.com")


def test_an_api_key_goes_before_a_token(data: Path, monkeypatch, provider: Provider):
    with_client(data)

    assert me(client(data, monkeypatch, provider), "energyid-key").json()["name"] == "energyid"


def test_without_a_token_the_login_still_counts(data: Path, monkeypatch, provider: Provider):
    api = client(data, monkeypatch, provider)
    log_in(api)

    assert api.get("/auth/me").json()["email"] == "ann@example.com"
