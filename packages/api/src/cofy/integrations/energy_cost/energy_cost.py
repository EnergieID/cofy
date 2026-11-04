import asyncio
import datetime as dt
from typing import Annotated, Literal

import pandas as pd
from fastapi import Query
from isodate import Duration
from pydantic import Field

from cofy.api import Referable, ValidationFailedError
from cofy.modules.tariff import PriceSource, PriceSourceSettings
from cofy.modules.timeseries import CacheSettings, ISODuration, Timeseries
from energy_cost import CostGroup, Tariff


class EnergyCostTariffSourceSettings(PriceSourceSettings):
    type: Literal["energy_cost"] = "energy_cost"
    tariff: Annotated[Tariff, Referable("tariff")] = Field(description="The tariff to compute prices from.")
    cost_group: CostGroup | None = Field(
        None,
        description="Which of the tariff's costs to price. When empty, each request picks one, consumption by default.",
    )


class EnergyCostTariffSource(PriceSource, settings=EnergyCostTariffSourceSettings):
    """Energy prices, computed from a tariff."""

    def __init__(self, tariff: Tariff, cost_group: CostGroup | None = None, cache: CacheSettings | None = None):
        super().__init__(cache=cache)
        self.tariff = tariff
        self.cost_group = cost_group

    async def _fetch_timeseries(
        self,
        start: dt.datetime,
        end: dt.datetime,
        resolution: ISODuration = dt.timedelta(minutes=15),
        cost_group: CostGroup | None = None,
        **kwargs,
    ) -> Timeseries:
        if isinstance(resolution, Duration):
            raise ValidationFailedError(
                "Resolution only support time components, not years or months, as they cannot be converted to a fixed number of seconds.",
                loc=("query", "resolution"),
            )
        cost_group = cost_group or self.cost_group
        if cost_group is None:
            raise ValidationFailedError("Cost group must be provided.", loc=("query", "cost_group"))
        series = await asyncio.to_thread(
            self.tariff.get_values,
            start=start,
            end=end,
            output_resolution=resolution,
            cost_group=cost_group,
        )
        if series is None:
            return Timeseries(
                frame=pd.DataFrame(
                    {"timestamp": pd.Series(dtype="datetime64[ns, UTC]"), "value": pd.Series(dtype=float)}
                ),
                metadata={"unit": "EUR/MWh"},
            )
        df = series.rename(columns={"total": "value"})
        df = df[df["value"].notna()].copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return Timeseries(frame=df, metadata={"unit": "EUR/MWh"})

    @property
    def supported_resolutions(self) -> list[str]:
        return ["PT5M", "PT15M", "PT1H", "P1D", "P7D"]

    @property
    def extra_args(self) -> dict:
        result = {}
        if self.cost_group is None:
            result["cost_group"] = Annotated[
                CostGroup,
                Query(
                    default=CostGroup.CONSUMPTION,
                ),
            ]

        return result
