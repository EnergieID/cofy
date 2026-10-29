import datetime as dt
from functools import partial
from unittest.mock import patch

import httpx
import polars as pl
import pytest
from pydantic import ValidationError

from cofy.integrations.elia import EliaSolarForecastSource
from cofy.modules.directive import DirectiveModule, DirectiveSource
from cofy.modules.timeseries import TimeseriesSource

MODULE = "cofy.integrations.elia.elia_solar_forecast"
QUARTER_HOUR = dt.timedelta(minutes=15)
START = dt.datetime(2026, 6, 21, 10, tzinfo=dt.UTC)


def record(timestamp: str, forecast: float | None, capacity: float | None = 1000.0) -> dict:
    return {"datetime": timestamp, "mostrecentforecast": forecast, "monitoredcapacity": capacity}


def elia(handler):
    """Replaces Elia Open Data with `handler`."""
    return patch(f"{MODULE}.httpx.AsyncClient", partial(httpx.AsyncClient, transport=httpx.MockTransport(handler)))


def elia_datasets(responses: dict[str, list[dict]], requests: dict[str, httpx.Request], capacity: float = 1000.0):
    """Replaces Elia Open Data with `responses` by dataset, recording the last request to each in `requests`."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params["select"] == "monitoredcapacity":
            requests["capacity"] = request
            return httpx.Response(200, json=[{"monitoredcapacity": capacity}])
        dataset = request.url.path.split("/")[-3]
        requests[dataset] = request
        return httpx.Response(200, json=responses[dataset])

    return elia(handler)


def test_build_frame_computes_share_of_capacity():
    frame = EliaSolarForecastSource._build_frame(
        [
            record("2026-06-21T10:00:00+00:00", 600.0),
            record("2026-06-21T10:15:00+00:00", None),
            record("2026-06-21T10:30:00+00:00", 100.0, capacity=0.0),
            record("2026-06-21T10:45:00+00:00", 100.0, capacity=None),
        ],
        QUARTER_HOUR,
    )

    assert frame["value"].to_list() == [60.0, 0.0, 0.0, 0.0]
    assert frame["timestamp"][0] == START


def test_build_frame_aggregates_to_hours():
    records = [
        record(f"2026-06-21T10:{m:02d}:00+00:00", v) for m, v in zip((0, 15, 30, 45), (100, 200, 300, 400), strict=True)
    ]
    records.append(record("2026-06-21T11:00:00+00:00", 500))

    frame = EliaSolarForecastSource._build_frame(records, dt.timedelta(hours=1))

    assert frame["value"].to_list() == [25.0, 50.0]


def test_build_frame_empty():
    frame = EliaSolarForecastSource._build_frame([], QUARTER_HOUR)

    assert frame.is_empty()
    assert frame.schema == pl.Schema({"timestamp": pl.Datetime(time_zone="UTC"), "value": pl.Float64})


@pytest.mark.asyncio
async def test_fetch_merges_datasets_preferring_near_real_time():
    start = dt.datetime(2026, 11, 2, 10, tzinfo=dt.UTC)
    responses = {
        "ods210": [
            {"datetime": "2026-11-02T10:15:00+00:00", "mostrecentforecast": 1000.0},
            {"datetime": "2026-11-02T10:30:00+00:00", "mostrecentforecast": 1200.0},
        ],
        "ods209": [record("2026-11-02T10:00:00+00:00", 400.0), record("2026-11-02T10:15:00+00:00", 1.0)],
    }
    requests: dict[str, httpx.Request] = {}

    with elia_datasets(responses, requests, capacity=2000.0):
        timeseries = await EliaSolarForecastSource(region="Antwerpen").fetch_timeseries(
            start, start + dt.timedelta(hours=1), QUARTER_HOUR
        )

    # ods209's own capacity for its records, its latest one for ods210's
    assert timeseries.frame["value"].to_list() == [40.0, 50.0, 60.0]
    assert timeseries.metadata["unit"] == "%"
    assert requests.keys() == {"ods210", "ods209", "capacity"}
    assert 'region="Antwerpen" and gridconnectiontype="All"' in requests["ods210"].url.params["where"]
    assert "monitoredcapacity" not in requests["ods210"].url.params["select"]
    assert 'region="Antwerpen" and gridconnectiontype="Total"' in requests["ods209"].url.params["where"]
    assert requests["capacity"].url.path.endswith("/ods209/exports/json")
    assert requests["capacity"].url.params["where"].startswith('region="Antwerpen" and gridconnectiontype="Total"')
    assert requests["capacity"].url.params["order_by"] == "datetime desc"


@pytest.mark.asyncio
async def test_fetch_raises_without_capacity():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    with elia(handler), pytest.raises(ValueError, match="no monitored capacity"):
        await EliaSolarForecastSource().fetch_timeseries(START, START + QUARTER_HOUR, QUARTER_HOUR)


@pytest.mark.asyncio
async def test_fetch_includes_legacy_dataset_before_its_end():
    start = dt.datetime(2026, 10, 25, 22, 45, tzinfo=dt.UTC)
    responses = {
        "ods210": [],
        "ods209": [record("2026-10-25T23:00:00+00:00", 200.0)],
        "ods032": [record("2026-10-25T22:45:00+00:00", 100.0)],
    }
    requests: dict[str, httpx.Request] = {}

    with elia_datasets(responses, requests):
        timeseries = await EliaSolarForecastSource(region="Antwerpen").fetch_timeseries(
            start, start + 2 * QUARTER_HOUR, QUARTER_HOUR
        )

    assert timeseries.frame["value"].to_list() == [10.0, 20.0]
    assert requests["ods032"].url.params["where"].startswith('region="Antwerp" and datetime')


@pytest.mark.asyncio
async def test_fetch_raises_on_error():
    with elia(lambda _: httpx.Response(500, text="boom")), pytest.raises(ValueError, match="500"):
        await EliaSolarForecastSource().fetch_timeseries(START, START + QUARTER_HOUR, QUARTER_HOUR)


@pytest.mark.asyncio
async def test_fetch_rejects_unsupported_resolution():
    with pytest.raises(ValueError, match="not supported"):
        await EliaSolarForecastSource().fetch_timeseries(START, START + dt.timedelta(days=1), dt.timedelta(days=1))


def test_source_can_be_created_from_settings():
    source = TimeseriesSource.create({"type": "elia_solar_forecast", "region": "WestVlaanderen"})

    assert isinstance(source, EliaSolarForecastSource)
    assert source.region == "WestVlaanderen"


def test_settings_reject_unknown_region():
    with pytest.raises(ValidationError):
        TimeseriesSource.create({"type": "elia_solar_forecast", "region": '" or region="Antwerpen'})


def test_settings_reject_legacy_region_name():
    with pytest.raises(ValidationError):
        TimeseriesSource.create({"type": "elia_solar_forecast", "region": "Antwerp"})


def test_directive_source_takes_it_from_settings():
    source = TimeseriesSource.create(
        {
            "type": "directive",
            "source": {"type": "elia_solar_forecast", "region": "Antwerpen"},
            "boundaries": [0, 3, 12, 40],
        }
    )

    assert isinstance(source, DirectiveSource)
    assert isinstance(source.source, EliaSolarForecastSource)
    assert source.supported_resolutions == ["PT1H", "PT15M"]
    assert DirectiveModule(source=source).merged_default_args["resolution"] == "PT1H"
