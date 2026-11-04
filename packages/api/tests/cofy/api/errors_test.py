import datetime as dt
from typing import Literal

import httpx
import pytest
from fastapi.responses import PlainTextResponse
from fastapi.testclient import TestClient

from cofy.api import CofyAPI, CofyError, Module, ModuleSettings, NotFoundError, ValidationFailedError
from cofy.api.errors import CONTENT_TYPE
from cofy.modules.timeseries import TimeseriesModule, TimeseriesSource, TimeseriesSourceSettings


class FailingModuleSettings(ModuleSettings):
    type: Literal["failing"] = "failing"


class FailingModule(Module, settings=FailingModuleSettings):
    """Raises each kind of error on demand."""

    type: str = "failing"

    def init_routes(self):
        self.add_api_route("/not-found", self.missing, methods=["GET"])
        self.add_api_route("/invalid", self.invalid, methods=["GET"])
        self.add_api_route("/bug", self.bug, methods=["GET"])
        self.add_api_route("/count", self.count, methods=["GET"])

    def missing(self):
        raise NotFoundError("Member not found")

    def invalid(self):
        raise ValidationFailedError("Pick another day", loc=("query", "day"))

    def bug(self):
        raise RuntimeError("https://upstream.example?securityToken=s3cret")

    def count(self, count: int) -> int:
        return count


class FailingSourceSettings(TimeseriesSourceSettings):
    type: Literal["failing_source"] = "failing_source"


class FailingSource(TimeseriesSource, settings=FailingSourceSettings):
    """Answers every fetch with the upstream response it was given."""

    def __init__(self, status: int):
        super().__init__()
        self.status = status

    async def _fetch_timeseries(self, start, end, resolution, **kwargs):
        request = httpx.Request("GET", "https://upstream.example?securityToken=s3cret")
        httpx.Response(self.status, text="upstream body", request=request).raise_for_status()


def client_for(*modules: Module) -> TestClient:
    return TestClient(CofyAPI(modules=list(modules)), raise_server_exceptions=False)


@pytest.fixture
def client() -> TestClient:
    return client_for(FailingModule())


START = dt.datetime(2026, 1, 1, tzinfo=dt.UTC)


@pytest.mark.parametrize(
    ("path", "status", "code"),
    [
        ("/failing/default/v1/not-found", 404, "not-found"),
        ("/failing/default/v1/invalid", 422, "validation-failed"),
        ("/failing/default/v1/count?count=many", 422, "validation-failed"),
        ("/failing/default/v1/bug", 500, "internal-error"),
        ("/nowhere", 404, "not-found"),
    ],
)
def test_every_failure_is_a_problem_document(client: TestClient, path: str, status: int, code: str):
    response = client.get(path)

    assert response.status_code == status
    assert response.headers["content-type"] == CONTENT_TYPE
    assert response.json()["status"] == status
    assert response.json()["code"] == code
    assert response.json()["title"]
    assert response.json()["detail"]


def test_a_validation_failure_names_the_part_of_the_request_at_fault(client: TestClient):
    problem = client.get("/failing/default/v1/invalid").json()

    assert problem["detail"] == "Pick another day"
    assert problem["errors"] == [{"loc": ["query", "day"], "msg": "Pick another day", "type": "value_error"}]


def test_an_unexpected_error_doesn_t_show_its_message(client: TestClient):
    assert "s3cret" not in client.get("/failing/default/v1/bug").text


@pytest.mark.parametrize(("upstream_status", "code"), [(500, "source-failed"), (401, "source-unauthorized")])
def test_a_failing_source_is_a_bad_gateway(upstream_status: int, code: str):
    module = TimeseriesModule(source=FailingSource(upstream_status))

    response = client_for(module).get(
        module.prefix, params={"start": START.isoformat(), "end": (START + dt.timedelta(hours=2)).isoformat()}
    )

    assert response.status_code == 502
    assert response.json()["code"] == code
    assert "s3cret" not in response.text
    assert "upstream body" not in response.text


def test_the_openapi_documents_problem_responses():
    timeseries = TimeseriesModule(source=FailingSource(500))
    schema = client_for(FailingModule(), timeseries).get("/openapi.json").json()

    problem = {"application/json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}}
    assert schema["paths"]["/failing/default/v1/count"]["get"]["responses"]["422"]["content"] == problem
    assert schema["paths"][timeseries.prefix]["get"]["responses"]["502"]["content"] == problem


def test_a_handler_passed_to_the_app_replaces_its_own_for_that_class():
    async def teapot(request, exc):
        return PlainTextResponse("teapot", status_code=418)

    client = TestClient(CofyAPI(modules=[FailingModule()], exception_handlers={CofyError: teapot}))

    assert client.get("/failing/default/v1/not-found").status_code == 418
    assert client.get("/failing/default/v1/count?count=many").json()["code"] == "validation-failed"
