import datetime as dt
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import Field

from cofy.modules.timeseries import (
    GenericTimeseriesFormatSettings,
    TimeseriesModule,
    TimeseriesModuleSettings,
    floor_datetime,
)

from .format import PriceFormatSettings
from .source import PriceSource, PriceSourceSettings

if TYPE_CHECKING:
    # Published at runtime by finalize(); the base classes are the static stand-ins.
    AnyPriceSourceSettings = PriceSourceSettings
    AnyGenericTimeseriesFormatSettings = GenericTimeseriesFormatSettings
    AnyPriceFormatSettings = PriceFormatSettings


class TariffModuleSettings(TimeseriesModuleSettings):
    type: Literal["tariff"] = "tariff"
    source: "AnyPriceSourceSettings" = Field(description="Where the prices come from.")
    # Generic formats, and the formats that only fit this module's series.
    formats: 'list[Annotated[AnyGenericTimeseriesFormatSettings | AnyPriceFormatSettings, Field(discriminator="type")]] | None' = Field(
        None,
        description="The formats the data is offered in. Defaults to JSON and CSV.",
        json_schema_extra={"x-advanced": True},
    )


class TariffModule(TimeseriesModule[PriceSource], settings=TariffModuleSettings):
    type: str = "tariff"
    type_description: str = "Serves energy prices as a time series."

    @property
    def default_args(self):
        return {
            "start": lambda: floor_datetime(dt.datetime.now(dt.UTC), dt.timedelta(minutes=15)),
            "end": lambda: None,
            "offset": 0,
            "limit": 288,
            "resolution": "PT15M",
        }
