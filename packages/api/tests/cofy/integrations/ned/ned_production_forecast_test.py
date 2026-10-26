import datetime as dt
from functools import partial
from unittest.mock import patch

import httpx
import polars as pl
import pytest
from pydantic import ValidationError

from cofy.integrations.ned import NedInstallation, NedProductionForecastSource
from cofy.modules.directive import DirectiveModule, DirectiveSource
from cofy.modules.timeseries import TimeseriesSource
from tests.cofy.secrets import with_secrets

MODULE = "cofy.integrations.ned.ned_production_forecast"
HOUR = dt.timedelta(hours=1)
QUARTER_HOUR = dt.timedelta(minutes=15)
START = dt.datetime(2026, 6, 21, 10, tzinfo=dt.UTC)

SOLAR = NedInstallation(region="Utrecht", type="solar", peak_power=100)
WIND = NedInstallation(region="Offshore", type="wind_offshore", peak_power=1000)


def record(timestamp: dt.datetime, percentage: float | None) -> dict:
    return {"validfrom": timestamp.isoformat(), "percentage": percentage}


def hours(*percentages: float | None, start: dt.datetime = START) -> list[dict]:
    return [record(start + i * HOUR, p) for i, p in enumerate(percentages)]


def ned(handler):
    """Replaces NED with `handler`."""
    return patch(f"{MODULE}.httpx.AsyncClient", partial(httpx.AsyncClient, transport=httpx.MockTransport(handler)))


def build(forecasts, installations, end=START + 3 * HOUR, resolution=HOUR):
    return NedProductionForecastSource._build_frame(forecasts, installations, START, end, resolution)


def test_build_frame_sums_installations_weighted_by_peak_power():
    frame = build([hours(0.5, 0.1), hours(0.2, None)], [SOLAR, WIND])

    assert frame["value"].to_list() == [250.0, 10.0]
    assert frame["timestamp"][0] == START


def test_build_frame_scales_to_kwh_per_quarter_hour():
    records = [record(START + i * QUARTER_HOUR, 0.4) for i in range(2)]

    frame = build([records], [SOLAR], resolution=QUARTER_HOUR)

    assert frame["value"].to_list() == [10.0, 10.0]


def test_build_frame_trims_to_the_requested_period():
    frame = build([hours(0.1, 0.2, 0.3, 0.4, start=START - HOUR)], [SOLAR], end=START + 2 * HOUR)

    assert frame["value"].to_list() == [20.0, 30.0]


def test_build_frame_empty():
    frame = build([[], []], [SOLAR, WIND])

    assert frame.is_empty()
    assert frame.schema == pl.Schema({"timestamp": pl.Datetime(time_zone="UTC"), "value": pl.Float64})


@pytest.mark.asyncio
async def test_fetch_queries_each_installation():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=hours(0.5) if request.url.params["type"] == "2" else hours(0.1))

    with ned(handler):
        timeseries = await NedProductionForecastSource(api_key="key", installations=[SOLAR, WIND]).fetch_timeseries(
            START, START + HOUR, HOUR
        )

    assert timeseries.frame["value"].to_list() == [150.0]
    assert timeseries.metadata["unit"] == "kWh"
    assert {(r.url.params["point"], r.url.params["type"]) for r in requests} == {("7", "2"), ("14", "17")}
    assert all(r.headers["X-AUTH-TOKEN"] == "key" for r in requests)
    assert all(r.url.params["classification"] == "1" and r.url.params["granularity"] == "5" for r in requests)
    assert requests[0].url.params["validfrom[after]"] == "2026-06-20"
    assert requests[0].url.params["validfrom[strictly_before]"] == "2026-06-22"


@pytest.mark.asyncio
async def test_fetch_follows_pages():
    pages = {"1": hours(*[0.0] * 200, start=START - 199 * HOUR), "2": hours(0.5)}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=pages[request.url.params["page"]])

    with ned(handler):
        timeseries = await NedProductionForecastSource(api_key="key", installations=[SOLAR]).fetch_timeseries(
            START, START + HOUR, HOUR
        )

    assert timeseries.frame["value"].to_list() == [50.0]


@pytest.mark.asyncio
async def test_fetch_raises_on_error():
    with ned(lambda _: httpx.Response(401, text="nope")), pytest.raises(ValueError, match="401"):
        await NedProductionForecastSource(api_key="key", installations=[SOLAR]).fetch_timeseries(
            START, START + HOUR, HOUR
        )


@pytest.mark.asyncio
async def test_fetch_rejects_unsupported_resolution():
    with pytest.raises(ValueError, match="not supported"):
        await NedProductionForecastSource(api_key="key", installations=[SOLAR]).fetch_timeseries(
            START, START + dt.timedelta(days=1), dt.timedelta(days=1)
        )


def test_requires_an_installation():
    with pytest.raises(ValueError, match="installation"):
        NedProductionForecastSource(api_key="key", installations=[])


def test_source_can_be_created_from_settings():
    with with_secrets(ned_key="key"):
        source = TimeseriesSource.create(
            {
                "type": "ned_production_forecast",
                "api_key": {"type": "secret", "name": "ned_key"},
                "installations": [{"region": "Utrecht", "type": "solar", "peak_power": 100}],
            }
        )

    assert isinstance(source, NedProductionForecastSource)
    assert source.api_key == "key"
    assert source.installations == [SOLAR]


@pytest.mark.parametrize(
    "installation",
    [
        {"region": "Antwerpen", "type": "solar", "peak_power": 100},
        {"region": "Utrecht", "type": "biogas", "peak_power": 100},
        {"region": "Utrecht", "type": "solar", "peak_power": 0},
        {"region": "Flevoland", "type": "wind_offshore", "peak_power": 100},
    ],
)
def test_settings_reject_invalid_installations(installation):
    with pytest.raises(ValidationError):
        TimeseriesSource.create(
            {
                "type": "ned_production_forecast",
                "api_key": {"type": "secret", "name": "ned_key"},
                "installations": [installation],
            }
        )


def test_directive_source_takes_it_from_settings():
    with with_secrets(ned_key="key"):
        source = TimeseriesSource.create(
            {
                "type": "directive",
                "source": {
                    "type": "ned_production_forecast",
                    "api_key": {"type": "secret", "name": "ned_key"},
                    "installations": [{"region": "Nederland", "type": "wind", "peak_power": 50}],
                },
                "boundaries": [5, 10, 20, 30],
            }
        )

    assert isinstance(source, DirectiveSource)
    assert isinstance(source.source, NedProductionForecastSource)
    assert DirectiveModule(source=source).merged_default_args["resolution"] == "PT1H"
