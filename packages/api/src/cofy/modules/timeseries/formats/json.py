import datetime as dt
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, create_model

from ..format import GenericTimeseriesFormat, TimeseriesFormat, TimeseriesFormatSettings
from ..model import ISODuration, Timeseries

DataType = TypeVar("DataType", bound=BaseModel)
MetadataType = TypeVar("MetadataType", bound=BaseModel)


class DefaultDataType(BaseModel):
    timestamp: dt.datetime
    value: float


class DefaultMetadataType(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    start: dt.datetime | None = None
    end: dt.datetime | None = None
    format: str = "json"
    resolution: ISODuration | None = None
    unit: str | None = None


class ResponseModel(BaseModel, Generic[DataType, MetadataType]):
    metadata: MetadataType
    data: list[DataType]


class BaseJSONFormat(TimeseriesFormat, Generic[DataType, MetadataType]):
    """Timeseries format for JSON, shared by the formats of each family that respond with it."""

    name = "json"

    # We need to pass the typing info at runtime, otherwise we don't have enough info to create the openapi schema
    # root cause is type erasure, see https://github.com/python/typing/issues/629#issuecomment-1831106590
    def __init__(self, DT: type[DataType] | None = None, MT: type[MetadataType] | None = None):
        super().__init__()
        self.DT = DT or DefaultDataType
        self.MT = MT or DefaultMetadataType
        self.ResponseModel = ResponseModel[self.DT, self.MT]

    def format(self, timeseries: Timeseries) -> ResponseModel:
        return self.ResponseModel(
            metadata=self.MT(**timeseries.metadata),
            data=[self.DT(**_nest(row)) for row in timeseries.to_arr()],
        )

    @property
    def ReturnType(self) -> type:
        return self.ResponseModel


class JSONFormatSettings(TimeseriesFormatSettings):
    type: Literal["json"] = "json"


class JSONFormat(
    BaseJSONFormat[DataType, MetadataType],
    GenericTimeseriesFormat,
    Generic[DataType, MetadataType],
    settings=JSONFormatSettings,
):
    """The data as JSON, with its unit and resolution alongside."""

    def for_columns(self, columns: dict[str, str]) -> "JSONFormat":
        if list(columns) == ["value"]:
            return self
        return JSONFormat(_model("", columns, timestamp=(dt.datetime, ...)), self.MT)


def _nest(row: dict[str, Any]) -> dict[str, Any]:
    """The row with each dotted column, such as `bought.total`, nested in an object per part."""
    nested: dict[str, Any] = {}
    for column, value in row.items():
        *groups, key = column.split(".")
        target = nested
        for group in groups:
            target = target.setdefault(group, {})
        target[key] = value
    return nested


def _model(path: str, columns: dict[str, str], name: str = "", **fields: Any) -> type[BaseModel]:
    """A model with a field per column directly under `path`: a number, or a model of the columns nested in it.

    The record is named after its columns, and each nested model after the record and its place, so formats for other
    columns get schemas of their own in an OpenAPI document.
    """
    prefix = f"{path}." if path else ""
    names = list(dict.fromkeys(column[len(prefix) :].split(".")[0] for column in columns if column.startswith(prefix)))
    name = name or _pascal("_".join(names)) + "Record"
    for field in names:
        child = prefix + field
        nested = any(column.startswith(f"{child}.") for column in columns)
        annotation = _model(child, columns, name + _pascal(child)) if nested else float
        fields[field] = (annotation, Field(description=columns.get(child)))
    return create_model(name, **fields)


def _pascal(name: str) -> str:
    return "".join(word.capitalize() for word in name.replace(".", "_").split("_"))
