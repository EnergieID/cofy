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
    responses = {
        "ods087": [record("2026-06-21T10:15:00+00:00", 500.0), record("2026-06-21T10:30:00+00:00", 600.0)],
        "ods032": [record("2026-06-21T10:00:00+00:00", 400.0), record("2026-06-21T10:15:00+00:00", 1.0)],
    }
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        dataset = request.url.path.split("/")[-3]
        return httpx.Response(200, json=responses[dataset])

    with elia(handler):
        timeseries = await EliaSolarForecastSource(region="Antwerp").fetch_timeseries(
            START, START + dt.timedelta(hours=1), QUARTER_HOUR
        )

    assert timeseries.frame["value"].to_list() == [40.0, 50.0, 60.0]
    assert timeseries.metadata["unit"] == "%"
    assert all('region="Antwerp"' in r.url.params["where"] for r in requests)


@pytest.mark.asyncio
async def test_fetch_raises_on_error():
    with elia(lambda _: httpx.Response(500, text="boom")), pytest.raises(ValueError, match="500"):
        await EliaSolarForecastSource().fetch_timeseries(START, START + QUARTER_HOUR, QUARTER_HOUR)


@pytest.mark.asyncio
async def test_fetch_rejects_unsupported_resolution():
    with pytest.raises(ValueError, match="not supported"):
        await EliaSolarForecastSource().fetch_timeseries(START, START + dt.timedelta(days=1), dt.timedelta(days=1))


def test_source_can_be_created_from_settings():
    source = TimeseriesSource.create({"type": "elia_solar_forecast", "region": "Flanders"})

    assert isinstance(source, EliaSolarForecastSource)
    assert source.region == "Flanders"


def test_settings_reject_unknown_region():
    with pytest.raises(ValidationError):
        TimeseriesSource.create({"type": "elia_solar_forecast", "region": '" or region="Flanders'})


def test_directive_source_takes_it_from_settings():
    source = TimeseriesSource.create(
        {
            "type": "directive",
            "source": {"type": "elia_solar_forecast", "region": "Antwerp"},
            "boundaries": [0, 3, 12, 40],
        }
    )

    assert isinstance(source, DirectiveSource)
    assert isinstance(source.source, EliaSolarForecastSource)
    assert source.supported_resolutions == ["PT1H", "PT15M"]
    assert DirectiveModule(source=source).merged_default_args["resolution"] == "PT1H"
