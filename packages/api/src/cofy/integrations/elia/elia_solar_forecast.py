import asyncio
import datetime as dt
from typing import Literal

import httpx
import polars as pl
from isodate import strftime
from pydantic import Field

from cofy.modules.timeseries import CacheSettings, ISODuration, NumericSource, NumericSourceSettings, Timeseries

ELIA_BASE_URL = "https://opendata.elia.be/api/explore/v2.1/catalog/datasets"
# Near-real-time dataset (today up to 10 days ahead) first, so it wins over the historical one on overlap. Each has its
# own name for the total of the PV connected to the distribution and the transmission grid.
NEAR_REAL_TIME_DATASET = "ods210"
HISTORICAL_DATASET = "ods209"
GRID_CONNECTION_TYPES = {NEAR_REAL_TIME_DATASET: "All", HISTORICAL_DATASET: "Total"}
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
            raise ValueError(
                f"Resolution {resolution_iso} is not supported. "
                f"Supported resolutions are: {', '.join(self.SUPPORTED_RESOLUTIONS)}"
            )

        queries = [(dataset, self._where(dataset)) for dataset in GRID_CONNECTION_TYPES]
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
            frame=self._build_frame(records, resolution),
            metadata={"unit": "%", "region": self.region, "source": "Elia Open Data"},
        )

    def _where(self, dataset: str) -> str:
        return f'region="{self.region}" and gridconnectiontype="{GRID_CONNECTION_TYPES[dataset]}"'

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
            where=f"{self._where(HISTORICAL_DATASET)} and monitoredcapacity is not null",
            select="monitoredcapacity",
            order_by="datetime desc",
            limit=1,
        )
        if not records:
            raise ValueError(f"Elia Open Data has no monitored capacity for {self.region}")
        return records[0]["monitoredcapacity"]

    @staticmethod
    async def _export(client: httpx.AsyncClient, dataset: str, **params) -> list[dict]:
        response = await client.get(f"/{dataset}/exports/json", params=params)
        if response.status_code != 200:
            raise ValueError(f"Failed to fetch {dataset} from Elia Open Data: {response.status_code} - {response.text}")
        return response.json()

    @staticmethod
    def _build_frame(records: list[dict], resolution: ISODuration) -> pl.DataFrame:
        if not records:
            return pl.DataFrame(schema=SCHEMA)

        capacity = pl.col("monitoredcapacity")
        frame = (
            pl.DataFrame(records, schema_overrides={"mostrecentforecast": pl.Float64, "monitoredcapacity": pl.Float64})
            .select(
                timestamp=pl.col("datetime").str.to_datetime(time_zone="UTC"),
                value=pl.when(capacity > 0)
                .then(pl.col("mostrecentforecast").fill_null(0) / capacity * 100)
                .otherwise(0.0),
            )
            .unique("timestamp", keep="first", maintain_order=True)
            .sort("timestamp")
        )

        if resolution != NATIVE_RESOLUTION:
            assert isinstance(resolution, dt.timedelta)
            frame = frame.group_by_dynamic("timestamp", every=resolution).agg(pl.col("value").mean())

        return frame.cast(SCHEMA)

    @property
    def supported_resolutions(self) -> list[str]:
        return self.SUPPORTED_RESOLUTIONS

    @property
    def max_age(self) -> dt.timedelta:
        # Elia refreshes its most recent forecast every quarter-hour
        return NATIVE_RESOLUTION
