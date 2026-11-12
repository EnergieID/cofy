"""The console's files, served beside the API, with its page for every path of its own."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.management.console_files import ConsoleFiles


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("the console")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "console.js").write_text("code")
    app = FastAPI()

    @app.get("/management/communities")
    def communities() -> list:
        return []

    app.mount("/", ConsoleFiles(str(tmp_path)), name="console")
    return TestClient(app)


def test_serves_the_console_s_files(client: TestClient):
    assert client.get("/assets/console.js").text == "code"
    assert client.get("/").text == "the console"


@pytest.mark.parametrize("path", ["/console", "/console/communities", "/console/communities/demo/secrets"])
def test_answers_a_path_of_the_console_s_own_with_its_page(client: TestClient, path: str):
    r = client.get(path)

    assert (r.status_code, r.text) == (200, "the console")


@pytest.mark.parametrize(
    "path", ["/assets/missing.js", "/locales/xx/app.yaml", "/management/nope", "/auth/nope", "/communities/demo"]
)
def test_leaves_a_missing_file_or_api_path_not_found(client: TestClient, path: str):
    assert client.get(path).status_code == 404


def test_leaves_the_api_to_the_api(client: TestClient):
    assert client.get("/management/communities").json() == []
