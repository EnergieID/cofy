from typing import Literal

from cofy.modules.simultaneity import RatioSource, RatioSourceSettings

from .series import DemoSeries, DemoSeriesSettings, pattern_field

# Hourly over a day, in UTC.
RATIOS: list[float] = [
    180,
    175,
    170,
    170,
    170,
    160,
    140,
    120,
    100,
    85,
    70,
    60,
    55,
    58,
    65,
    80,
    100,
    125,
    150,
    170,
    180,
    185,
    185,
    180,
]


class DemoRatioSourceSettings(RatioSourceSettings, DemoSeriesSettings):
    type: Literal["demo_ratio"] = "demo_ratio"
    pattern: list[float] = pattern_field(RATIOS)


class DemoRatioSource(DemoSeries, RatioSource, settings=DemoRatioSourceSettings):
    """Generated simultaneity ratios, for demos."""

    default_pattern = RATIOS
    unit = "%"
