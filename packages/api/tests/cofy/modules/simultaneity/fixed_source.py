import datetime as dt

import polars as pl

from cofy.modules.timeseries import CONSUMPTION, INJECTION, EnergyBalanceSource, ISODuration, Timeseries

START = dt.datetime(2026, 1, 1, 0, 0, tzinfo=dt.UTC)
QUARTER = dt.timedelta(minutes=15)


class FixedSource(EnergyBalanceSource):
    """Returns the given balances at consecutive quarter-hours from START: a net volume, or consumption and injection."""

    def __init__(
        self,
        values: list[float | tuple[float, float]],
        *,
        metadata: dict | None = None,
        resolutions: list[str] | None = None,
        max_age: dt.timedelta | None = None,
    ):
        super().__init__()
        self.values = [value if isinstance(value, tuple) else (max(0.0, value), max(0.0, -value)) for value in values]
        self.metadata = metadata or {}
        self.resolutions = resolutions or []
        self._max_age = max_age

    async def _fetch_timeseries(
        self, start: dt.datetime, end: dt.datetime, resolution: ISODuration, **kwargs
    ) -> Timeseries:
        data = {
            "timestamp": [START + i * QUARTER for i in range(len(self.values))],
            CONSUMPTION: [consumption for consumption, _ in self.values],
            INJECTION: [injection for _, injection in self.values],
        }
        schema = {"timestamp": pl.Datetime(time_zone="UTC"), CONSUMPTION: pl.Float64, INJECTION: pl.Float64}
        return Timeseries(frame=pl.DataFrame(data, schema=schema), metadata=dict(self.metadata))

    @property
    def supported_resolutions(self) -> list[str]:
        return self.resolutions

    @property
    def max_age(self) -> dt.timedelta | None:
        return self._max_age
