import asyncio
import datetime as dt
from collections.abc import Sequence
from typing import TYPE_CHECKING, Literal

import narwhals as nw
from pydantic import Field

from cofy.modules.timeseries import (
    CONSUMPTION,
    INJECTION,
    CacheSettings,
    EnergyBalanceSource,
    EnergyBalanceSourceSettings,
    ISODuration,
    Timeseries,
)

from ..source import RatioSource, RatioSourceSettings

if TYPE_CHECKING:
    # Published at runtime by finalize(); the base class is the static stand-in.
    AnyEnergyBalanceSourceSettings = EnergyBalanceSourceSettings


class SimultaneitySourceSettings(RatioSourceSettings):
    type: Literal["simultaneity"] = "simultaneity"
    # Unresolved until cofy.api.finalize() publishes the discriminated unions.
    sources: "list[AnyEnergyBalanceSourceSettings]" = Field(
        min_length=1, description="The energy balances of the connections to total."
    )


class SimultaneitySource(RatioSource, settings=SimultaneitySourceSettings):
    """Production as a percentage of consumption per timestamp, over the energy balances of connections."""

    def __init__(self, sources: Sequence[EnergyBalanceSource], cache: CacheSettings | None = None):
        """Total injection as a percentage of total consumption per timestamp, over energy balances.

        A timestamp is only counted when every source has a value for it.

        Args:
            sources: The energy balances of the connections.
            cache: Cache what this source fetches, see `TimeseriesSource`.
        """
        super().__init__(cache=cache)
        if not sources:
            raise ValueError("At least one source must be provided")
        self.sources = sources

    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration,
        **kwargs,
    ) -> Timeseries:
        results = await asyncio.gather(
            *(source.fetch_timeseries(start, end, resolution, **kwargs) for source in self.sources)
        )

        consumption = nw.col("consumption")
        production = nw.col("production")
        frame = (
            nw.concat(
                [
                    ts.frame.select("timestamp", consumption=nw.col(CONSUMPTION), production=nw.col(INJECTION))
                    for ts in results
                ]
            )
            .group_by("timestamp")
            .agg(consumption.sum(), production.sum(), sources=nw.len())
            # a source without data at a timestamp leaves it unknown, not zero
            .filter(nw.col("sources") == len(self.sources))
            .with_columns(
                # no volume at all is neither surplus nor shortage, so report it as balanced
                value=nw.when((consumption == 0) & (production == 0))
                .then(nw.lit(100.0))
                .when(consumption == 0)
                .then(nw.lit(float("inf")))
                .otherwise(production / consumption * 100)
            )
            .select("timestamp", "value")
            .sort("timestamp")
        )

        metadata: dict = {"unit": "%"}
        # the result is only as fresh as its least fresh input
        expires = [ts.metadata["expires"] for ts in results if "expires" in ts.metadata]
        if expires:
            metadata["expires"] = min(expires)
        return Timeseries(frame=frame, metadata=metadata)

    @property
    def supported_resolutions(self) -> list[str]:
        # an empty list means a source supports all resolutions, so it doesn't constrain the intersection
        constrained = [set(source.supported_resolutions) for source in self.sources if source.supported_resolutions]
        if not constrained:
            return []
        return list(set.intersection(*constrained))

    @property
    def max_age(self) -> dt.timedelta | None:
        # the result is only as fresh as its least fresh input, and unknown if any input is unknown
        max_ages = [source.max_age for source in self.sources]
        known = [max_age for max_age in max_ages if max_age is not None]
        if len(known) < len(max_ages):
            return None
        return min(known)
