from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import Field

from cofy.modules.timeseries import (
    GenericTimeseriesFormatSettings,
    TimeseriesFormat,
    TimeseriesModule,
    TimeseriesModuleSettings,
)

from .format import DirectiveSeriesFormatSettings
from .formats.directive import DirectiveFormat
from .source import DirectiveSeriesSource, DirectiveSeriesSourceSettings

if TYPE_CHECKING:
    # Published at runtime by finalize(); the base classes are the static stand-ins.
    AnyDirectiveSeriesSourceSettings = DirectiveSeriesSourceSettings
    AnyGenericTimeseriesFormatSettings = GenericTimeseriesFormatSettings
    AnyDirectiveSeriesFormatSettings = DirectiveSeriesFormatSettings


class DirectiveModuleSettings(TimeseriesModuleSettings):
    type: Literal["directive"] = "directive"
    source: "AnyDirectiveSeriesSourceSettings" = Field(description="Where the directives come from.")
    # Generic formats, and the formats that only fit this module's series.
    formats: 'list[Annotated[AnyGenericTimeseriesFormatSettings | AnyDirectiveSeriesFormatSettings, Field(discriminator="type")]] | None' = Field(
        None,
        description="The formats the data is offered in. Defaults to the directive format.",
        json_schema_extra={"x-advanced": True},
    )


class DirectiveModule(TimeseriesModule[DirectiveSeriesSource], settings=DirectiveModuleSettings):
    type: str = "directive"
    type_description: str = (
        "Serves directives, steps from -- to ++ telling members when to use less or more energy, as a time series."
    )

    def __init__(self, source: DirectiveSeriesSource, formats: list[TimeseriesFormat] | None = None, **kwargs):
        if formats is None:
            formats = [DirectiveFormat()]

        super().__init__(source=source, formats=formats, **kwargs)
