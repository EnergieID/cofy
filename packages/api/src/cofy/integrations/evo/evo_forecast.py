import datetime as dt
from typing import Literal

from .connection_source import EvoConnectionSource, EvoConnectionSourceSettings


class EvoForecastSourceSettings(EvoConnectionSourceSettings):
    type: Literal["evo_forecast"] = "evo_forecast"


class EvoForecastSource(EvoConnectionSource, settings=EvoForecastSourceSettings):
    """The forecast energy balance of a connection, from EvO (Energie van Ons): a few days ahead, and past forecasts kept.

    EvO only forecasts the net volume, so a quarter-hour either consumes or injects, never both.
    """

    kind = "forecasts"

    def _balance(self, record: dict) -> tuple[float, float]:
        net = float(record["amount_kwh"])
        return max(0.0, net), max(0.0, -net)

    @property
    def max_age(self) -> dt.timedelta:
        # EvO publishes no refresh rate; forecasts change during the day
        return dt.timedelta(hours=1)
