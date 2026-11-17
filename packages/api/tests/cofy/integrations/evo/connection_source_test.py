import asyncio
import datetime as dt
import json
import time
from unittest.mock import MagicMock, patch

import pytest
import requests
from google.auth.exceptions import RefreshError
from pydantic import ValidationError

from cofy.api import SourceError, SourceUnauthorizedError, ValidationFailedError
from cofy.integrations.evo import EvoAllocationSource, EvoForecastSource
from cofy.integrations.evo.client import EVO_MAX_RANGE, EVO_TIMEOUT
from cofy.modules.timeseries import TimeseriesSource
from tests.cofy.secrets import with_secrets

CLIENT = "cofy.integrations.evo.client"
EAN = "541234567890123456"
BASE_URL = "https://evo.example"
CREDENTIALS = json.dumps({"type": "service_account", "client_email": "test@acc-ops.iam.gserviceaccount.com"})
START = dt.datetime(2026, 1, 1, 0, 0, tzinfo=dt.UTC)
END = dt.datetime(2026, 1, 1, 0, 45, tzinfo=dt.UTC)
QUARTER = dt.timedelta(minutes=15)

FIRST_PAGE = {
    "data": [
        {"delivery_start": "2026-01-01T00:00:00Z", "amount_kwh": "1.5"},
        {"delivery_start": "2026-01-01T00:15:00Z", "amount_kwh": "-2.25"},
    ],
    "next": f"/v1/connections/{EAN}/forecasts?cursor=abc",
}
LAST_PAGE = {"data": [{"delivery_start": "2026-01-01T00:30:00Z", "amount_kwh": "0"}], "next": None}
EMPTY = {"data": [], "next": None}


def response(status_code: int, payload: dict | None = None) -> MagicMock:
    mock = MagicMock(status_code=status_code, text="error")
    mock.json.return_value = payload
    if status_code >= 400:
        mock.raise_for_status.side_effect = requests.HTTPError(response=mock)
    return mock


@pytest.fixture
def id_token():
    """Replaces the Google service-account ID token with one that is valid until refreshed."""
    with patch(f"{CLIENT}.IDTokenCredentials") as credentials_class:
        credentials = credentials_class.from_service_account_info.return_value
        credentials.valid = False
        credentials.token = "test-token"
        credentials.refresh.side_effect = lambda _request: setattr(credentials, "valid", True)
        yield credentials_class


def test_requests_id_token_for_connection_usage_service(id_token):
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)
    id_token.from_service_account_info.assert_not_called()

    assert source.client.credentials is id_token.from_service_account_info.return_value
    id_token.from_service_account_info.assert_called_once_with(
        json.loads(CREDENTIALS), target_audience="connection-usage"
    )


@pytest.mark.asyncio
async def test_fetches_all_pages_of_forecasts(id_token):
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS, base_url=BASE_URL)

    with patch(f"{CLIENT}.requests.get", side_effect=[response(200, FIRST_PAGE), response(200, LAST_PAGE)]) as get:
        result = await source.fetch_timeseries(START, END, QUARTER)

    assert result.to_arr() == [
        # EvO forecasts the net volume, which is either consumed or injected
        {"timestamp": START, "consumption.total": 1.5, "injection.total": 0.0},
        {"timestamp": START + QUARTER, "consumption.total": 0.0, "injection.total": 2.25},
        {"timestamp": START + 2 * QUARTER, "consumption.total": 0.0, "injection.total": 0.0},
    ]
    assert result.metadata == {"unit": "kWh"}

    first, second = get.call_args_list
    assert first.args == (f"{BASE_URL}/v1/connections/{EAN}/forecasts",)
    assert first.kwargs["params"] == {"from_dt": START.isoformat(), "to_dt": END.isoformat()}
    assert first.kwargs["headers"] == {"Authorization": "Bearer test-token"}
    assert first.kwargs["timeout"] == second.kwargs["timeout"] == EVO_TIMEOUT
    assert second.args == (f"{BASE_URL}{FIRST_PAGE['next']}",)
    # the token is refreshed once and reused while valid
    id_token.from_service_account_info.return_value.refresh.assert_called_once()


@pytest.mark.asyncio
async def test_allocations_are_what_is_taken_and_fed(id_token):
    source = EvoAllocationSource(ean=EAN, credentials=CREDENTIALS, base_url=BASE_URL)
    page = {
        "data": [
            {"delivery_start": "2026-01-01T00:00:00Z", "amount_take_kwh": "2.5", "amount_feed_kwh": "0.000"},
            {"delivery_start": "2026-01-01T00:15:00Z", "amount_take_kwh": "0.4", "amount_feed_kwh": "781.8"},
        ],
        "next": None,
    }

    with patch(f"{CLIENT}.requests.get", return_value=response(200, page)) as get:
        result = await source.fetch_timeseries(START, END, QUARTER)

    # both in the same quarter-hour, as a digital meter registers them
    assert [(row["consumption.total"], row["injection.total"]) for row in result.to_arr()] == [(2.5, 0.0), (0.4, 781.8)]
    assert get.call_args.args == (f"{BASE_URL}/v1/connections/{EAN}/allocations",)


@pytest.mark.asyncio
async def test_a_long_range_is_requested_in_parts(id_token):
    source = EvoAllocationSource(ean=EAN, credentials=CREDENTIALS, base_url=BASE_URL)
    end = START + 2 * EVO_MAX_RANGE + dt.timedelta(days=1)

    with patch(f"{CLIENT}.requests.get", return_value=response(200, EMPTY)) as get:
        await source.fetch_timeseries(START, end, QUARTER)

    assert [call.kwargs["params"] for call in get.call_args_list] == [
        {"from_dt": START.isoformat(), "to_dt": (START + EVO_MAX_RANGE).isoformat()},
        {"from_dt": (START + EVO_MAX_RANGE).isoformat(), "to_dt": (START + 2 * EVO_MAX_RANGE).isoformat()},
        {"from_dt": (START + 2 * EVO_MAX_RANGE).isoformat(), "to_dt": end.isoformat()},
    ]


@pytest.mark.asyncio
async def test_without_an_ean_each_fetch_passes_one(id_token):
    source = EvoForecastSource(credentials=CREDENTIALS, base_url=BASE_URL)

    assert set(source.extra_args) == {"ean"}
    with patch(f"{CLIENT}.requests.get", return_value=response(200, EMPTY)) as get:
        await source.fetch_timeseries(START, END, QUARTER, ean=EAN)
    assert get.call_args.args == (f"{BASE_URL}/v1/connections/{EAN}/forecasts",)

    with pytest.raises(ValidationFailedError):
        await source.fetch_timeseries(START, END, QUARTER)


def test_with_an_ean_requests_pass_none(id_token):
    assert EvoForecastSource(ean=EAN, credentials=CREDENTIALS).extra_args == {}


@pytest.mark.asyncio
async def test_empty_response_gives_empty_timeseries(id_token):
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)

    with patch(f"{CLIENT}.requests.get", return_value=response(200, EMPTY)):
        result = await source.fetch_timeseries(START, END, QUARTER)

    assert result.to_arr() == []


@pytest.mark.asyncio
async def test_rejected_credentials_raise(id_token):
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)

    with patch(f"{CLIENT}.requests.get", return_value=response(403)), pytest.raises(SourceUnauthorizedError):
        await source.fetch_timeseries(START, END, QUARTER)


@pytest.mark.asyncio
async def test_a_refused_key_raises(id_token):
    id_token.from_service_account_info.return_value.refresh.side_effect = RefreshError("invalid_grant")
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)

    with pytest.raises(SourceUnauthorizedError):
        await source.fetch_timeseries(START, END, QUARTER)


@pytest.mark.asyncio
async def test_an_unreachable_token_service_is_a_source_failure(id_token):
    id_token.from_service_account_info.return_value.refresh.side_effect = RefreshError("unavailable", retryable=True)
    source = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)

    with pytest.raises(SourceError) as error:
        await source.fetch_timeseries(START, END, QUARTER)

    assert type(error.value) is SourceError


@pytest.mark.asyncio
async def test_an_unreadable_key_raises():
    source = EvoForecastSource(ean=EAN, credentials="not json")

    with pytest.raises(SourceUnauthorizedError):
        await source.fetch_timeseries(START, END, QUARTER)


def test_resolutions_and_max_age(id_token):
    forecast = EvoForecastSource(ean=EAN, credentials=CREDENTIALS)
    allocation = EvoAllocationSource(ean=EAN, credentials=CREDENTIALS)

    assert forecast.supported_resolutions == allocation.supported_resolutions == ["PT15M"]
    assert forecast.max_age == dt.timedelta(hours=1)
    assert allocation.max_age == dt.timedelta(hours=6)


@pytest.mark.parametrize("source_type", ["evo_forecast", "evo_allocation"])
def test_create_from_settings(id_token, source_type):
    with with_secrets(evo_credentials=CREDENTIALS):
        source = TimeseriesSource.create(
            {
                "type": source_type,
                "credentials": {"type": "secret", "name": "evo_credentials"},
                "base_url": BASE_URL,
            }
        )

    assert isinstance(source, EvoForecastSource if source_type == "evo_forecast" else EvoAllocationSource)
    assert source.ean is None
    assert source.client.base_url == BASE_URL


def test_rejects_an_ean_that_is_not_18_digits():
    with with_secrets(evo_credentials=CREDENTIALS), pytest.raises(ValidationError):
        TimeseriesSource.create(
            {"type": "evo_forecast", "ean": "541", "credentials": {"type": "secret", "name": "evo_credentials"}}
        )


@pytest.mark.asyncio
async def test_connections_fetched_at_once_share_one_token_refresh(id_token):
    credentials = id_token.from_service_account_info.return_value
    credentials.token = None

    def slow_refresh(_request):
        time.sleep(0.05)
        credentials.token = "test-token"
        credentials.valid = True

    credentials.refresh.side_effect = slow_refresh
    source = EvoForecastSource(credentials=CREDENTIALS)

    with patch(f"{CLIENT}.requests.get", return_value=response(200, EMPTY)) as get:
        await asyncio.gather(
            *(source.fetch_timeseries(START, END, QUARTER, ean=f"54123456789012345{i}") for i in range(5))
        )

    assert {call.kwargs["headers"]["Authorization"] for call in get.call_args_list} == {"Bearer test-token"}
    credentials.refresh.assert_called_once()
