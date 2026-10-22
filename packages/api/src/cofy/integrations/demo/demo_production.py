from typing import Literal

from cofy.modules.production import ProductionSource, ProductionSourceSettings

from .series import DemoSeries, DemoSeriesSettings, pattern_field

# Hourly over a day, in UTC.
PRODUCTION: list[float] = [
    0,
    0,
    0,
    0,
    0,
    0.1,
    0.4,
    0.9,
    1.5,
    2.1,
    2.6,
    2.9,
    3.0,
    2.8,
    2.4,
    1.8,
    1.1,
    0.5,
    0.1,
    0,
    0,
    0,
    0,
    0,
]


class DemoProductionSourceSettings(ProductionSourceSettings, DemoSeriesSettings):
    type: Literal["demo_production"] = "demo_production"
    pattern: list[float] = pattern_field(PRODUCTION)


class DemoProductionSource(DemoSeries, ProductionSource, settings=DemoProductionSourceSettings):
    """Generated solar production, for demos."""

    default_pattern = PRODUCTION
    unit = "kWh"
