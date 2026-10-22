import datetime as dt
from typing import Literal

import polars as pl

from cofy.modules.directive import BoundarySource, BoundarySourceSettings
from cofy.modules.timeseries import CacheSettings, ISODuration, ISOTimedelta, Timeseries

from .series import DAY, pattern_at, pattern_field, period_field, timestamps

# Four sets over a day, in UTC.
BOUNDARIES: list[tuple[float, float, float, float]] = [
    (60, 75, 90, 110),
    (80, 100, 120, 140),
    (40, 55, 70, 90),
    (90, 110, 130, 150),
]


class DemoBoundarySourceSettings(BoundarySourceSettings):
    type: Literal["demo_boundary"] = "demo_boundary"
    pattern: list[tuple[float, float, float, float]] = pattern_field(BOUNDARIES)
    period: ISOTimedelta = period_field()


class DemoBoundarySource(BoundarySource, settings=DemoBoundarySourceSettings):
    """Generated directive boundaries, for demos."""

    def __init__(
        self,
        pattern: list[tuple[float, float, float, float]] = BOUNDARIES,
        period: dt.timedelta = DAY,
        cache: CacheSettings | None = None,
    ):
        super().__init__(cache=cache)
        self.pattern = pattern
        self.period = period

    async def _fetch_timeseries(
        self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs
    ) -> Timeseries:
        steps = timestamps(start, end, resolution)
        boundaries = [pattern_at(self.pattern, self.period, step) for step in steps]
        frame = pl.DataFrame(
            {"timestamp": steps, **{f"b{i}": [float(b[i]) for b in boundaries] for i in range(4)}},
            schema={"timestamp": pl.Datetime(time_zone="UTC"), **{f"b{i}": pl.Float64 for i in range(4)}},
        )
        return Timeseries(frame=frame)
