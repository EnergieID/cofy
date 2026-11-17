import datetime as dt
from typing import Literal

import narwhals as nw

from cofy.modules.timeseries import (
    CONSUMPTION,
    INJECTION,
    EnergyBalanceSource,
    EnergyBalanceSourceSettings,
    ISODuration,
    Timeseries,
)

from .series import DemoSeries, DemoSeriesSettings, pattern_field

# Net volumes, hourly over a day, in UTC: consumption positive, injection negative.
NET_VOLUMES: list[float] = [
    0.4,
    0.3,
    0.3,
    0.3,
    0.3,
    0.4,
    0.6,
    0.5,
    -0.2,
    -0.8,
    -1.4,
    -1.7,
    -1.8,
    -1.6,
    -1.2,
    -0.6,
    0.1,
    0.8,
    1.2,
    1.1,
    0.9,
    0.7,
    0.6,
    0.5,
]


class DemoEnergyBalanceSourceSettings(EnergyBalanceSourceSettings, DemoSeriesSettings):
    type: Literal["demo_energy_balance"] = "demo_energy_balance"
    pattern: list[float] = pattern_field(NET_VOLUMES)


class DemoEnergyBalanceSource(DemoSeries, EnergyBalanceSource, settings=DemoEnergyBalanceSourceSettings):
    """A generated energy balance of a household with solar panels, for demos: it consumes or injects the pattern's net volume."""

    default_pattern = NET_VOLUMES
    unit = "kWh"

    async def _fetch_timeseries(
        self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs
    ) -> Timeseries:
        net = await super()._fetch_timeseries(start, end, resolution, **kwargs)
        frame = net.frame.select(
            "timestamp",
            nw.col("value").clip(lower_bound=0).alias(CONSUMPTION),
            (-nw.col("value")).clip(lower_bound=0).alias(INJECTION),
        )
        return Timeseries(frame=frame, metadata=net.metadata)
