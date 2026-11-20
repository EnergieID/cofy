import datetime as dt
import json
import threading
from functools import cached_property
from urllib.parse import urljoin

import requests
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.service_account import IDTokenCredentials

from cofy.api import SourceUnauthorizedError

EVO_BASE_URL = "https://connection-usage-service-prd-730943142752.europe-west1.run.app"
EVO_TARGET_AUDIENCE = "connection-usage"
# seconds; without one a hanging EvO service blocks the request, and the cache lock held for it, indefinitely
EVO_TIMEOUT = 30
# EvO's service times out on long ranges, so a range is requested in parts of at most this length
EVO_MAX_RANGE = dt.timedelta(days=31)


class EvoClient:
    def __init__(self, credentials: str, base_url: str = EVO_BASE_URL):
        """A client of EvO's (Energie van Ons) Connection Usage Service.

        Args:
            credentials: Google service-account credentials JSON provided by EvO.
            base_url: Base URL of the Connection Usage Service.
        """
        self.base_url = base_url.rstrip("/")
        self._service_account = credentials
        # requests for several connections run in threads at once, which must not refresh the token at the same time
        self._lock = threading.Lock()

    @cached_property
    def credentials(self) -> IDTokenCredentials:
        # built on first use, so a misconfigured source fails its requests rather than app startup
        try:
            return IDTokenCredentials.from_service_account_info(
                json.loads(self._service_account), target_audience=EVO_TARGET_AUDIENCE
            )
        except ValueError as exc:
            raise SourceUnauthorizedError("The service account key for EvO isn't a valid one.") from exc

    def _token(self) -> str | None:
        """A valid ID token, refreshed when it isn't."""
        with self._lock:
            if not self.credentials.valid:
                try:
                    self.credentials.refresh(Request())
                except RefreshError as exc:
                    # one that can't be retried is the key being refused, not the token service being unreachable
                    if exc.retryable:
                        raise
                    raise SourceUnauthorizedError("The service account key for EvO was refused.") from exc
            return self.credentials.token

    def _get(self, url: str, params: dict | None = None) -> dict:
        response = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {self._token()}"},
            timeout=EVO_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()

    def connection_data(self, ean: str, kind: str, start: dt.datetime, end: dt.datetime) -> list[dict]:
        """Every record of a connection's `kind` (e.g. forecasts) in [start, end), following all pages."""
        records = []
        part_start = start
        while part_start < end:
            part_end = min(part_start + EVO_MAX_RANGE, end)
            page = self._get(
                f"{self.base_url}/v1/connections/{ean}/{kind}",
                {"from_dt": part_start.isoformat(), "to_dt": part_end.isoformat()},
            )
            records.extend(page["data"])
            while page.get("next"):
                page = self._get(urljoin(self.base_url, page["next"]))
                records.extend(page["data"])
            part_start = part_end
        return records
