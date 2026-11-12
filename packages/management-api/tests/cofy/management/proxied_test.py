"""Serving through reverse proxies that put the API under a path of their own site."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from cofy.management.proxied import ProxiedUrls


def app_at(*urls: str) -> TestClient:
    app = FastAPI()

    @app.get("/where")
    def where(request: Request) -> dict:
        return {"base": str(request.base_url), "url": str(request.url)}

    app.add_middleware(ProxiedUrls, urls=list(urls))
    return TestClient(app)


def test_a_request_through_a_known_proxy_is_made_to_its_url():
    r = app_at("https://app.example/cofy").get("/where?x=1", headers={"X-Forwarded-Prefix": "/cofy"})

    assert r.json() == {"base": "https://app.example/cofy/", "url": "https://app.example/cofy/where?x=1"}


def test_a_port_is_kept():
    r = app_at("http://localhost:5173/cofy").get("/where", headers={"X-Forwarded-Prefix": "/cofy"})

    assert r.json()["base"] == "http://localhost:5173/cofy/"


def test_a_request_without_a_known_prefix_is_left_as_it_is():
    client = app_at("https://app.example/cofy")

    assert client.get("/where").json()["base"] == "http://testserver/"
    assert client.get("/where", headers={"X-Forwarded-Prefix": "/other"}).json()["base"] == "http://testserver/"


@pytest.mark.parametrize("url", ["https://app.example", "https://app.example/", "ftp://app.example/cofy", "/cofy"])
def test_a_proxied_url_needs_a_scheme_a_host_and_a_path(url: str):
    with pytest.raises(ValueError, match="with a path"):
        ProxiedUrls(FastAPI(), [url])


def test_each_proxied_url_needs_a_path_of_its_own():
    with pytest.raises(ValueError, match="used twice"):
        ProxiedUrls(FastAPI(), ["https://a.example/cofy", "https://b.example/cofy/"])
