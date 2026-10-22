from typing import Literal

from cofy.modules.tariff import PriceSource, PriceSourceSettings

from .series import DemoSeries, DemoSeriesSettings, pattern_field

# Hourly over a day, in UTC.
PRICES: list[float] = [
    85,
    80,
    76,
    74,
    75,
    82,
    98,
    118,
    115,
    95,
    72,
    55,
    45,
    42,
    50,
    68,
    92,
    125,
    140,
    128,
    110,
    98,
    92,
    88,
]


class DemoPriceSourceSettings(PriceSourceSettings, DemoSeriesSettings):
    type: Literal["demo_price"] = "demo_price"
    pattern: list[float] = pattern_field(PRICES)


class DemoPriceSource(DemoSeries, PriceSource, settings=DemoPriceSourceSettings):
    """Generated day-ahead prices, for demos."""

    default_pattern = PRICES
    unit = "EUR/MWh"
