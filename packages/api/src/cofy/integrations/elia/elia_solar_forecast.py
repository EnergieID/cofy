import asyncio
import datetime as dt
import logging
from typing import Literal

import httpx
import polars as pl
from isodate import strftime
from pydantic import Field

from cofy.api import SourceError, ValidationFailedError
from cofy.modules.timeseries import CacheSettings, ISODuration, NumericSource, NumericSourceSettings, Timeseries

LOGGER = logging.getLogger(__name__)

ELIA_BASE_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets"
# Near-real-time dataset (today up to 10 days ahead) first, so it wins over the historical one on overlap
NEAR_REAL_TIME_DATASET = "ods210"
HISTORICAL_DATASET = "ods209"
# The total of the PV connected to the distribution and the transmission grid
GRID_CONNECTION_TYPE = "Total"
# Elia's discontinued historical dataset, up to where ods209 starts, with its own region names
LEGACY_DATASET = "ods032"
LEGACY_END = dt.datetime(2026, 10, 25, 23, tzinfo=dt.UTC)
LEGACY_REGIONS = {
    "Brussel": "Brussels",
    "Antwerpen": "Antwerp",
    "OostVlaanderen": "East-Flanders",
    "VlaamsBrabant": "Flemish-Brabant",
    "WestVlaanderen": "West-Flanders",
    "Liege": "Liège",
    "BrabantWallon": "Walloon-Brabant",
}
NATIVE_RESOLUTION = dt.timedelta(minutes=15)
# seconds; without one a hanging Elia blocks the request, and the cache lock held for it, indefinitely
ELIA_TIMEOUT = 30

SCHEMA = pl.Schema({"timestamp": pl.Datetime(time_zone="UTC"), "value": pl.Float64})

EliaRegion = Literal[
    "Belgium",
    "Brussel",
    "Antwerpen",
    "OostVlaanderen",
    "VlaamsBrabant",
    "Limburg",
    "WestVlaanderen",
    "Hainaut",
    "Liege",
    "Luxembourg",
    "Namur",
    "BrabantWallon",
]


class EliaSolarForecastSourceSettings(NumericSourceSettings):
    type: Literal["elia_solar_forecast"] = "elia_solar_forecast"
    region: EliaRegion = Field("Belgium", description="The region the forecast is for.")


class EliaSolarForecastSource(NumericSource, settings=EliaSolarForecastSourceSettings):
    """Elia's most recent solar production forecast of a Belgian region, as % of its monitored PV capacity."""

    # The first one is a module's default resolution
    SUPPORTED_RESOLUTIONS: list[str] = ["PT1H", "PT15M"]

    def __init__(self, region: EliaRegion = "Belgium", cache: CacheSettings | None = None) -> None:
        """Elia's most recent solar production forecast, as % of the monitored PV capacity.

        Args:
            region: The Elia region: Belgium, Brussel, or a province like "Antwerpen".
            cache: Cache what this source fetches, see `TimeseriesSource`.
        """
        super().__init__(cache=cache)
        self.region = region

    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        **kwargs,
    ) -> Timeseries:
        resolution_iso = strftime(resolution, "P%P")
        if resolution_iso not in self.SUPPORTED_RESOLUTIONS:
            raise ValidationFailedError(
                f"Resolution {resolution_iso} is not supported. "
                f"Supported resolutions are: {', '.join(self.SUPPORTED_RESOLUTIONS)}",
                loc=("query", "resolution"),
            )

        queries = [(dataset, self._where()) for dataset in (NEAR_REAL_TIME_DATASET, HISTORICAL_DATASET)]
        if start < LEGACY_END:
            queries.append((LEGACY_DATASET, f'region="{LEGACY_REGIONS.get(self.region, self.region)}"'))

        async with httpx.AsyncClient(base_url=ELIA_BASE_URL, timeout=ELIA_TIMEOUT) as client:
            capacity, responses = await asyncio.gather(
                self._fetch_capacity(client),
                asyncio.gather(*(self._fetch_dataset(client, d, where, start, end) for d, where in queries)),
            )

        # The near-real-time dataset has no capacity of its own, so its forecast is a share of the latest one
        records = [{"monitoredcapacity": capacity, **record} for response in responses for record in response]
        return Timeseries(
            frame=self._build_frame(records, start, end, resolution),
            metadata={"unit": "%", "region": self.region, "source": "Elia Open Data"},
        )

    def _where(self) -> str:
        return f'region="{self.region}" and gridconnectiontype="{GRID_CONNECTION_TYPE}"'

    async def _fetch_dataset(
        self, client: httpx.AsyncClient, dataset: str, where: str, start: dt.datetime, end: dt.datetime
    ) -> list[dict]:
        fields = (
            "datetime,mostrecentforecast"
            if dataset == NEAR_REAL_TIME_DATASET
            else "datetime,mostrecentforecast,monitoredcapacity"
        )
        return await self._export(
            client,
            dataset,
            where=f'{where} and datetime>="{start.isoformat()}" and datetime<"{end.isoformat()}"',
            select=fields,
            order_by="datetime",
        )

    async def _fetch_capacity(self, client: httpx.AsyncClient) -> float:
        """The region's most recent monitored PV capacity, in MW."""
        records = await self._export(
            client,
            HISTORICAL_DATASET,
            where=f"{self._where()} and monitoredcapacity is not null",
            select="monitoredcapacity",
            order_by="datetime desc",
            limit=1,
        )
        if not records:
            raise SourceError(f"Elia Open Data has no monitored capacity for {self.region}")
        return records[0]["monitoredcapacity"]

    @staticmethod
    async def _export(client: httpx.AsyncClient, dataset: str, **params) -> list[dict]:
        response = await client.get(f"/{dataset}/exports/json", params=params)
        response.raise_for_status()
        return response.json()

    def _build_frame(
        self, records: list[dict], start: dt.datetime, end: dt.datetime, resolution: ISODuration
    ) -> pl.DataFrame:
        frame = pl.DataFrame(schema=SCHEMA)
        if records:
            capacity = pl.col("monitoredcapacity")
            frame = (
                pl.DataFrame(
                    records, schema_overrides={"mostrecentforecast": pl.Float64, "monitoredcapacity": pl.Float64}
                )
                .select(
                    timestamp=pl.col("datetime").str.to_datetime(time_zone="UTC"),
                    value=pl.when(capacity > 0).then(pl.col("mostrecentforecast") / capacity * 100),
                )
                # Left out rather than zero, so a later dataset can fill them
                .drop_nulls("value")
                .unique("timestamp", keep="first", maintain_order=True)
                .sort("timestamp")
            )
        self._warn_missing(frame, start, end)

        if resolution != NATIVE_RESOLUTION:
            assert isinstance(resolution, dt.timedelta)
            frame = frame.group_by_dynamic("timestamp", every=resolution).agg(pl.col("value").mean())

        return frame.cast(SCHEMA)

    def _warn_missing(self, frame: pl.DataFrame, start: dt.datetime, end: dt.datetime) -> None:
        """Logs a warning for the quarter-hours from `start` to `end` that Elia has no forecast for."""
        step = NATIVE_RESOLUTION.total_seconds()
        first = dt.datetime.fromtimestamp(-(-start.timestamp() // step) * step, dt.UTC)
        if first >= end:
            return
        expected = pl.datetime_range(first, end, NATIVE_RESOLUTION, closed="left", time_zone="UTC", eager=True)
        missing = expected.filter(~expected.is_in(frame["timestamp"].implode()))
        if not missing.is_empty():
            LOGGER.warning(
                "Elia Open Data has no solar forecast for %s at %d of %d quarter-hours, from %s to %s",
                self.region,
                len(missing),
                len(expected),
                missing[0].isoformat(),
                missing[-1].isoformat(),
            )

    @property
    def supported_resolutions(self) -> list[str]:
        return self.SUPPORTED_RESOLUTIONS

    @property
    def max_age(self) -> dt.timedelta:
        # Elia refreshes its most recent forecast every quarter-hour
        return NATIVE_RESOLUTION
