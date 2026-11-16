import datetime as dt

from fastapi import FastAPI
from fastapi.testclient import TestClient

from cofy.api.module import Module
from cofy.modules.directive import DirectiveFormat, DirectiveModule, DirectiveSource

from ..timeseries.dummy_source import DummyNumericSource


def test_directivemodule_type_property():
    module = DirectiveModule(source=DirectiveSource(DummyNumericSource(), boundaries=(5, 15, 25, 35)))
    assert module.type == "directive"


def test_formats_default():
    module = DirectiveModule(source=DirectiveSource(DummyNumericSource(), boundaries=(5, 15, 25, 35)))
    assert len(module.formats) == 1
    assert isinstance(module.formats[0], DirectiveFormat)


def test_api_endpoint_returns_directives():
    start = dt.datetime(2026, 1, 1, 0, 0, tzinfo=dt.UTC)
    end = dt.datetime(2026, 1, 1, 3, 0, tzinfo=dt.UTC)
    module = DirectiveModule(
        source=DirectiveSource(DummyNumericSource(), boundaries=(5, 15, 25, 35)),
    )

    app = FastAPI()
    app.include_router(module)
    client = TestClient(app)

    response = client.get(
        module.prefix,
        params={
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["format"] == "json"
    assert payload["metadata"]["resolution"] == "PT1H"
    assert [entry["value"] for entry in payload["data"]] == ["--", "-", "0"]


class QuarterHourFirstSource(DummyNumericSource):
    def __init__(self, resolutions: list[str]):
        super().__init__()
        self.resolutions = resolutions

    @property
    def supported_resolutions(self) -> list[str]:
        return self.resolutions


def test_defaults_to_hourly_resolution():
    module = DirectiveModule(
        source=DirectiveSource(QuarterHourFirstSource(["PT15M", "PT1H"]), boundaries=(5, 15, 25, 35))
    )
    assert module.merged_default_args["resolution"] == "PT1H"


def test_defaults_to_the_first_resolution_without_hourly_one():
    module = DirectiveModule(source=DirectiveSource(QuarterHourFirstSource(["PT15M"]), boundaries=(5, 15, 25, 35)))
    assert module.merged_default_args["resolution"] == "PT15M"


def test_can_create_from_settings():
    module = Module.create(
        {
            "type": "directive",
            "source": {
                "type": "directive",
                "source": {"type": "dummy_numeric_source"},
                "boundaries": [5, 15, 25, 35],
            },
        }
    )

    assert isinstance(module, DirectiveModule)
