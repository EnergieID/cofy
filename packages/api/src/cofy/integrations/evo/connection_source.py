import asyncio
import datetime as dt
from typing import Annotated, Literal

import polars as pl
from fastapi import Query
from pydantic import Field

from cofy.api import Secret, ValidationFailedError
from cofy.modules.timeseries import (
    CONSUMPTION,
    INJECTION,
    CacheSettings,
    EnergyBalanceSource,
    EnergyBalanceSourceSettings,
    ISODuration,
    Timeseries,
)

from .client import EVO_BASE_URL, EvoClient

EAN_PATTERN = r"^\d{18}$"


class EvoConnectionSourceSettings(EnergyBalanceSourceSettings):
    # Not registered itself: the shared fields of the EvO connection sources.
    type: Literal["evo_connection"] = "evo_connection"
    ean: str | None = Field(
        None,
        pattern=EAN_PATTERN,
        description="The EAN code of the connection. When empty, each request picks one.",
    )
    credentials: Secret = Field(description="The service account key, in JSON, that EvO (Energie van Ons) provided.")
    base_url: str = Field(
        EVO_BASE_URL,
        description="The address of EvO's Connection Usage Service. Only change it to use another environment.",
        json_schema_extra={"x-advanced": True},
    )


class EvoConnectionSource(EnergyBalanceSource):
    """The energy balance of a connection, from EvO's (Energie van Ons) Connection Usage Service."""

    kind: str
    """The kind of data in the Connection Usage Service, as named in its path."""

    def __init__(
        self,
        credentials: str,
        ean: str | None = None,
        base_url: str = EVO_BASE_URL,
        cache: CacheSettings | None = None,
    ) -> None:
        """The energy one connection takes from the grid and gives to it, in kWh per quarter-hour.

        Args:
            credentials: Google service-account credentials JSON provided by EvO.
            ean: EAN18 code of the connection; when None, each fetch passes one as `ean`.
            base_url: Base URL of the Connection Usage Service.
            cache: Cache what this source fetches, see `TimeseriesSource`.
        """
        super().__init__(cache=cache)
        self.ean = ean
        self.client = EvoClient(credentials, base_url)

    def _balance(self, record: dict) -> tuple[float, float]:
        """The consumption and injection of a record, in kWh."""
        raise NotImplementedError

    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        ean: str | None = None,
        **kwargs,
    ) -> Timeseries:
        ean = ean or self.ean
        if ean is None:
            raise ValidationFailedError("An EAN must be provided.", loc=("query", "ean"))

        records = await asyncio.to_thread(self.client.connection_data, ean, self.kind, start, end)
        balances = [self._balance(record) for record in records]
        frame = pl.DataFrame(
            {
                "timestamp": [record["delivery_start"] for record in records],
                CONSUMPTION: [consumption for consumption, _ in balances],
                INJECTION: [injection for _, injection in balances],
            },
            schema={"timestamp": pl.String, CONSUMPTION: pl.Float64, INJECTION: pl.Float64},
        ).with_columns(pl.col("timestamp").str.to_datetime(time_zone="UTC"))
        return Timeseries(frame=frame, metadata={"unit": "kWh"})

    @property
    def supported_resolutions(self) -> list[str]:
        return ["PT15M"]

    @property
    def extra_args(self) -> dict:
        if self.ean is not None:
            return {}
        return {"ean": Annotated[str, Field(Query(pattern=EAN_PATTERN, description="The EAN code of the connection."))]}
