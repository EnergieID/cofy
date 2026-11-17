import datetime as dt
from typing import Literal

from .connection_source import EvoConnectionSource, EvoConnectionSourceSettings


class EvoAllocationSourceSettings(EvoConnectionSourceSettings):
    type: Literal["evo_allocation"] = "evo_allocation"


class EvoAllocationSource(EvoConnectionSource, settings=EvoAllocationSourceSettings):
    """The allocated (measured) energy balance of a connection, from EvO (Energie van Ons), up to a few days ago."""

    kind = "allocations"

    def _balance(self, record: dict) -> tuple[float, float]:
        return float(record["amount_take_kwh"]), float(record["amount_feed_kwh"])

    @property
    def max_age(self) -> dt.timedelta:
        # EvO publishes a day's allocations a few days later, so fresh ones only appear once a day
        return dt.timedelta(hours=6)
