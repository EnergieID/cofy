import datetime as dt
import json
from unittest.mock import MagicMock, patch

import pytest
import requests
from google.auth.exceptions import RefreshError

from cofy.api import SourceError, SourceUnauthorizedError
from cofy.integrations.acc import AccForecastSource
from cofy.integrations.acc.acc_forecast import ACC_TIMEOUT
from cofy.modules.timeseries import TimeseriesSource
from tests.cofy.secrets import with_secrets

MODULE = "cofy.integrations.acc.acc_forecast"
BASE_URL = "https://acc.example"
CREDENTIALS = json.dumps({"type": "service_account", "client_email": "test@acc-ops.iam.gserviceaccount.com"})
START = dt.datetime(2026, 1, 1, 0, 0, tzinfo=dt.UTC)
END = dt.datetime(2026, 1, 1, 0, 45, tzinfo=dt.UTC)

FIRST_PAGE = {
    "data": [
        {"delivery_start": "2026-01-01T00:00:00Z", "amount_kwh": "1.5"},
        {"delivery_start": "2026-01-01T00:15:00Z", "amount_kwh": "-2.25"},
    ],
    "next": "/v1/connections/541234567890123456/forecasts?cursor=abc",
}
LAST_PAGE = {
    "data": [{"delivery_start": "2026-01-01T00:30:00Z", "amount_kwh": "0"}],
    "next": None,
}


def response(status_code: int, payload: dict | None = None) -> MagicMock:
    mock = MagicMock(status_code=status_code, text="error")
    mock.json.return_value = payload
    if status_code >= 400:
        mock.raise_for_status.side_effect = requests.HTTPError(response=mock)
    return mock


@pytest.fixture
def id_token():
    """Replaces the Google service-account ID token with one that is valid until refreshed."""
    with patch(f"{MODULE}.IDTokenCredentials") as credentials_class:
        credentials = credentials_class.from_service_account_info.return_value
        credentials.valid = False
        credentials.token = "test-token"
        credentials.refresh.side_effect = lambda _request: setattr(credentials, "valid", True)
        yield credentials_class


def test_ean_is_required(id_token):
    with pytest.raises(ValueError):
        AccForecastSource(ean="", credentials=CREDENTIALS)


def test_requests_id_token_for_connection_usage_service(id_token):
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)
    id_token.from_service_account_info.assert_not_called()

    assert source.credentials is id_token.from_service_account_info.return_value
    id_token.from_service_account_info.assert_called_once_with(
        json.loads(CREDENTIALS), target_audience="connection-usage"
    )


@pytest.mark.asyncio
async def test_fetches_all_pages(id_token):
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS, base_url=BASE_URL)

    with patch(f"{MODULE}.requests.get", side_effect=[response(200, FIRST_PAGE), response(200, LAST_PAGE)]) as get:
        result = await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))

    assert result.to_arr() == [
        {"timestamp": START, "value": 1.5},
        {"timestamp": START + dt.timedelta(minutes=15), "value": -2.25},
        {"timestamp": START + dt.timedelta(minutes=30), "value": 0.0},
    ]
    assert result.metadata == {"unit": "kWh"}

    first, second = get.call_args_list
    assert first.args == (f"{BASE_URL}/v1/connections/541234567890123456/forecasts",)
    assert first.kwargs["params"] == {"from_dt": START.isoformat(), "to_dt": END.isoformat()}
    assert first.kwargs["headers"] == {"Authorization": "Bearer test-token"}
    assert first.kwargs["timeout"] == second.kwargs["timeout"] == ACC_TIMEOUT
    assert second.args == (f"{BASE_URL}{FIRST_PAGE['next']}",)
    # the token is refreshed once and reused while valid
    id_token.from_service_account_info.return_value.refresh.assert_called_once()


@pytest.mark.asyncio
async def test_empty_response_gives_empty_timeseries(id_token):
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)

    with patch(f"{MODULE}.requests.get", return_value=response(200, {"data": [], "next": None})):
        result = await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))

    assert result.to_arr() == []


@pytest.mark.asyncio
async def test_rejected_credentials_raise(id_token):
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)

    with (
        patch(f"{MODULE}.requests.get", return_value=response(403)),
        pytest.raises(SourceUnauthorizedError),
    ):
        await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))


@pytest.mark.asyncio
async def test_a_refused_key_raises(id_token):
    id_token.from_service_account_info.return_value.refresh.side_effect = RefreshError("invalid_grant")
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)

    with pytest.raises(SourceUnauthorizedError):
        await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))


@pytest.mark.asyncio
async def test_an_unreachable_token_service_is_a_source_failure(id_token):
    id_token.from_service_account_info.return_value.refresh.side_effect = RefreshError("unavailable", retryable=True)
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)

    with pytest.raises(SourceError) as error:
        await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))

    assert type(error.value) is SourceError


@pytest.mark.asyncio
async def test_an_unreadable_key_raises():
    source = AccForecastSource(ean="541234567890123456", credentials="not json")

    with pytest.raises(SourceUnauthorizedError):
        await source.fetch_timeseries(START, END, dt.timedelta(minutes=15))


def test_supported_resolutions(id_token):
    source = AccForecastSource(ean="541234567890123456", credentials=CREDENTIALS)

    assert source.supported_resolutions == ["PT15M"]


def test_create_from_settings(id_token):
    with with_secrets(acc_credentials=CREDENTIALS):
        source = TimeseriesSource.create(
            {
                "type": "acc_forecast",
                "ean": "541234567890123456",
                "credentials": {"type": "secret", "name": "acc_credentials"},
                "base_url": BASE_URL,
            }
        )

    assert isinstance(source, AccForecastSource)
    assert source.ean == "541234567890123456"
    assert source.base_url == BASE_URL
