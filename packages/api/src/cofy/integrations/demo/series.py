import datetime as dt
import random
from collections.abc import Sequence
from typing import Any, TypeVar

import polars as pl
from pydantic import BaseModel, Field

from cofy.modules.timeseries import CacheSettings, ISODuration, ISOTimedelta, Timeseries, TimeseriesSource

T = TypeVar("T")

DAY = dt.timedelta(days=1)
# A Monday, so a weekly pattern starts on Mondays.
EPOCH = dt.datetime(2024, 1, 1, tzinfo=dt.UTC)


def timestamps(start: dt.datetime, end: dt.datetime, resolution: ISODuration) -> list[dt.datetime]:
    """Every step of *resolution* from *start* up to *end*."""
    result = []
    while start < end:
        result.append(start)
        start = start + resolution
    return result


def pattern_at(pattern: Sequence[T], period: dt.timedelta, timestamp: dt.datetime) -> T:
    """The value of *pattern*, spread evenly over each *period*, at *timestamp*."""
    return pattern[(timestamp - EPOCH) % period * len(pattern) // period]


def pattern_field(default: list[Any]) -> Any:
    return Field(default, min_length=1, description="The values, spread evenly over each period.")


def period_field() -> Any:
    return Field(DAY, description="How long it takes the pattern to repeat.", json_schema_extra={"x-advanced": True})


class DemoSeriesSettings(BaseModel):
    """The settings of every demo series."""

    period: ISOTimedelta = period_field()
    noise: float = Field(0.0, ge=0, le=1, description="Random variation of each value, as a fraction of it.")


class DemoSeries(TimeseriesSource):
    """Values repeating a pattern, randomly varied by a fraction *noise* of each, the same for each timestamp."""

    default_pattern: list[float]
    unit: str

    def __init__(
        self,
        pattern: list[float] | None = None,
        period: dt.timedelta = DAY,
        noise: float = 0.0,
        cache: CacheSettings | None = None,
    ):
        super().__init__(cache=cache)
        self.pattern = self.default_pattern if pattern is None else pattern
        self.period = period
        self.noise = noise

    def value_at(self, timestamp: dt.datetime) -> float:
        value = pattern_at(self.pattern, self.period, timestamp)
        variation = random.Random(f"{type(self).__name__}:{timestamp.timestamp()}").uniform(-self.noise, self.noise)
        return value * (1 + variation)

    async def _fetch_timeseries(
        self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs
    ) -> Timeseries:
        steps = timestamps(start, end, resolution)
        frame = pl.DataFrame(
            {"timestamp": steps, "value": [self.value_at(step) for step in steps]},
            schema={"timestamp": pl.Datetime(time_zone="UTC"), "value": pl.Float64},
        )
        return Timeseries(frame=frame, metadata={"unit": self.unit})
