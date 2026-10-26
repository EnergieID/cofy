import asyncio
import datetime as dt
from typing import Literal

import httpx
import polars as pl
from isodate import strftime
from pydantic import BaseModel, Field

from cofy.api import Secret
from cofy.modules.timeseries import CacheSettings, ISODuration, NumericSource, NumericSourceSettings, Timeseries

NED_BASE_URL = "https://api.ned.nl/v1"
# seconds; without one a hanging NED blocks the request, and the cache lock held for it, indefinitely
NED_TIMEOUT = 30
# NED's maximum page size
PAGE_SIZE = 200

SCHEMA = pl.Schema({"timestamp": pl.Datetime(time_zone="UTC"), "value": pl.Float64})

NedRegion = Literal[
    "Nederland",
    "Groningen",
    "Friesland",
    "Drenthe",
    "Overijssel",
    "Flevoland",
    "Gelderland",
    "Utrecht",
    "Noord-Holland",
    "Zuid-Holland",
    "Zeeland",
    "Noord-Brabant",
    "Limburg",
    "Offshore",
]
NedProductionType = Literal["solar", "wind", "wind_offshore"]

POINTS: dict[str, int] = {
    "Nederland": 0,
    "Groningen": 1,
    "Friesland": 2,
    "Drenthe": 3,
    "Overijssel": 4,
    "Flevoland": 5,
    "Gelderland": 6,
    "Utrecht": 7,
    "Noord-Holland": 8,
    "Zuid-Holland": 9,
    "Zeeland": 10,
    "Noord-Brabant": 11,
    "Limburg": 12,
    "Offshore": 14,
}
TYPES: dict[str, int] = {"wind": 1, "solar": 2, "wind_offshore": 17}
GRANULARITIES: dict[str, int] = {"PT15M": 4, "PT1H": 5}
FORECAST = 1
PROVIDING = 1
UTC = 0


class NedInstallation(BaseModel):
    region: NedRegion = Field(description="The region whose forecast the installation follows.")
    type: NedProductionType = Field(description="The kind of production.")
    peak_power: float = Field(gt=0, description="The peak power of the installation, in kW.")


class NedProductionForecastSourceSettings(NumericSourceSettings):
    type: Literal["ned_production_forecast"] = "ned_production_forecast"
    api_key: Secret
    installations: list[NedInstallation] = Field(min_length=1)


class NedProductionForecastSource(NumericSource, settings=NedProductionForecastSourceSettings):
    """Forecast production of a set of Dutch installations, from the Nationaal Energie Dashboard."""

    # The first one is a module's default resolution
    SUPPORTED_RESOLUTIONS: list[str] = ["PT1H", "PT15M"]

    def __init__(self, api_key: str, installations: list[NedInstallation], cache: CacheSettings | None = None) -> None:
        """Forecast production in kWh per interval, summed over installations that each follow their region's forecast.

        Args:
            api_key: The NED API key.
            installations: The installations, each producing NED's forecast utilization of its region and type times its peak power.
            cache: Cache what this source fetches, see `TimeseriesSource`.
        """
        super().__init__(cache=cache)
        if not installations:
            raise ValueError("At least one installation must be provided")

        self.api_key = api_key
        self.installations = installations

    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        **kwargs,
    ) -> Timeseries:
        resolution_iso = strftime(resolution, "P%P")
        if resolution_iso not in self.SUPPORTED_RESOLUTIONS:
            raise ValueError(
                f"Resolution {resolution_iso} is not supported. "
                f"Supported resolutions are: {', '.join(self.SUPPORTED_RESOLUTIONS)}"
            )
        assert isinstance(resolution, dt.timedelta)

        async with httpx.AsyncClient(
            base_url=NED_BASE_URL,
            headers={"X-AUTH-TOKEN": self.api_key, "Accept": "application/json"},
            timeout=NED_TIMEOUT,
        ) as client:
            forecasts = await asyncio.gather(
                *(self._fetch_installation(client, i, start, end, resolution_iso) for i in self.installations)
            )

        return Timeseries(
            frame=self._build_frame(forecasts, self.installations, start, end, resolution),
            metadata={"unit": "kWh", "source": "Nationaal Energie Dashboard"},
        )

    async def _fetch_installation(
        self,
        client: httpx.AsyncClient,
        installation: NedInstallation,
        start: dt.datetime,
        end: dt.datetime,
        resolution: str,
    ) -> list[dict]:
        # NED filters on dates only, in a timezone it doesn't state, so take a day of margin and trim afterwards
        params = {
            "point": POINTS[installation.region],
            "type": TYPES[installation.type],
            "granularity": GRANULARITIES[resolution],
            "granularitytimezone": UTC,
            "classification": FORECAST,
            "activity": PROVIDING,
            "validfrom[after]": (start - dt.timedelta(days=1)).date().isoformat(),
            "validfrom[strictly_before]": (end + dt.timedelta(days=1)).date().isoformat(),
            "order[validfrom]": "asc",
            "itemsPerPage": PAGE_SIZE,
        }
        records: list[dict] = []
        page = 1
        while True:
            response = await client.get("/utilizations", params={**params, "page": page})
            if response.status_code != 200:
                raise ValueError(f"Failed to fetch forecast from NED: {response.status_code} - {response.text}")
            batch = response.json()
            records.extend(batch)
            if len(batch) < PAGE_SIZE:
                return records
            page += 1

    @staticmethod
    def _build_frame(
        forecasts: list[list[dict]],
        installations: list[NedInstallation],
        start: dt.datetime,
        end: dt.datetime,
        resolution: dt.timedelta,
    ) -> pl.DataFrame:
        hours = resolution / dt.timedelta(hours=1)
        frames = [
            pl.DataFrame(records, schema_overrides={"percentage": pl.Float64}).select(
                timestamp=pl.col("validfrom").str.to_datetime(time_zone="UTC"),
                # NED's percentage is the utilization of the installed capacity, as a fraction
                value=pl.col("percentage").fill_null(0) * installation.peak_power * hours,
            )
            for records, installation in zip(forecasts, installations, strict=True)
            if records
        ]
        if not frames:
            return pl.DataFrame(schema=SCHEMA)

        return (
            pl.concat(frames)
            .filter((pl.col("timestamp") >= start) & (pl.col("timestamp") < end))
            .group_by("timestamp")
            .agg(pl.col("value").sum())
            .sort("timestamp")
            .cast(SCHEMA)
        )

    @property
    def supported_resolutions(self) -> list[str]:
        return self.SUPPORTED_RESOLUTIONS

    @property
    def max_age(self) -> dt.timedelta:
        # NED refreshes its forecasts at most every quarter-hour
        return dt.timedelta(minutes=15)
