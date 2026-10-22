from typing import Literal

from cofy.modules.simultaneity import NetVolumeSource, NetVolumeSourceSettings

from .series import DemoSeries, DemoSeriesSettings, pattern_field

# Hourly over a day, in UTC.
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


class DemoNetVolumeSourceSettings(NetVolumeSourceSettings, DemoSeriesSettings):
    type: Literal["demo_net_volume"] = "demo_net_volume"
    pattern: list[float] = pattern_field(NET_VOLUMES)


class DemoNetVolumeSource(DemoSeries, NetVolumeSource, settings=DemoNetVolumeSourceSettings):
    """Generated net volumes of a household with solar panels, for demos."""

    default_pattern = NET_VOLUMES
    unit = "kWh"
