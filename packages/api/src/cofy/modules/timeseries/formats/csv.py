from typing import Literal

from fastapi.responses import StreamingResponse

from ..format import GenericTimeseriesFormat, TimeseriesFormatSettings
from ..model import Timeseries
from .json import DefaultMetadataType


class CSVFormatSettings(TimeseriesFormatSettings):
    type: Literal["csv"] = "csv"


class CSVFormat(GenericTimeseriesFormat, settings=CSVFormatSettings):
    """The data as CSV, a row per timestamp."""

    name = "csv"

    def __init__(self, columns: list[str] | None = None):
        super().__init__()
        self.columns = columns or ["value"]

    def for_columns(self, columns: dict[str, str]) -> "CSVFormat":
        # a column of which others are part, such as `bought` of `bought.total`, only describes them
        return CSVFormat([column for column in columns if not any(other.startswith(f"{column}.") for other in columns)])

    def format(self, timeseries: Timeseries) -> StreamingResponse:
        return StreamingResponse(
            content=timeseries.to_csv(),
            media_type="text/csv",
            headers={"x-metadata": DefaultMetadataType(**timeseries.metadata).model_dump_json()},
        )

    @property
    def ReturnType(self) -> type:
        return StreamingResponse

    @property
    def responses(self) -> dict:
        return {
            200: {
                "content": {
                    "text/csv": {
                        "schema": {"type": "string", "format": "csv"},
                        "example": f"timestamp,{','.join(self.columns)}\n2023-01-01T00:00:00Z,{','.join('123.45' for _ in self.columns)}\n",
                    }
                },
                "description": "Timeseries data in CSV format",
                "headers": {
                    "x-metadata": {
                        "description": "Metadata for the timeseries as a JSON-encoded string",
                        "schema": {
                            "type": "string",
                            "contentMediaType": "application/json",
                            "contentSchema": DefaultMetadataType.model_json_schema(),
                        },
                    }
                },
            }
        }

    @property
    def response_class(self) -> type[StreamingResponse]:
        """Return the response class for this format."""
        return StreamingResponse
