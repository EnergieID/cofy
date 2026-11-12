"""Calls from the pages of apps embedding the console."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.management.cors import install_cors

HOST = "https://app.energyid.example"


def client() -> TestClient:
    app = FastAPI()
    app.get("/auth/me")(lambda: {"email": "ann@example.com"})
    install_cors(app, [HOST])
    return TestClient(app)


def preflight(origin: str):
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    }
    return client().options("/auth/me", headers=headers)


def test_a_listed_site_may_call_with_its_token():
    r = preflight(HOST)

    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == HOST
    assert "authorization" in r.headers["access-control-allow-headers"].lower()


def test_a_listed_site_never_gets_the_cookies():
    r = client().get("/auth/me", headers={"Origin": HOST})

    assert r.headers["access-control-allow-origin"] == HOST
    assert "access-control-allow-credentials" not in r.headers


def test_another_site_is_refused():
    r = preflight("https://elsewhere.example")

    assert r.status_code == 400
    assert "access-control-allow-origin" not in r.headers
