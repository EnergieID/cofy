"""Schemas nothing is valid against: for a type left out of a JSON Schema, and for a family nothing implements yet.

A model left out is generated as a schema nothing is valid against, wherever it is nested, so the schema around it
says exactly what is accepted. What to offer where such a schema ends up - a union's dead branch, a field nothing fits
- is for whatever reads the schema to decide.
"""

from __future__ import annotations

from collections.abc import Collection
from typing import Any

from pydantic import BaseModel, GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic.json_schema import GenerateJsonSchema, JsonSchemaValue
from pydantic_core import CoreSchema, core_schema

NEVER: JsonSchemaValue = {"not": {}}
"""A JSON Schema nothing is valid against."""


class Nothing:
    """A type no value is valid for - a field's type where there is nothing it could hold - with a JSON Schema
    saying so."""

    @classmethod
    def __get_pydantic_core_schema__(cls, source: Any, handler: GetCoreSchemaHandler) -> CoreSchema:
        def reject(value: Any) -> Any:
            raise ValueError("Nothing can be configured here")

        return core_schema.no_info_plain_validator_function(reject)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema: CoreSchema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        return dict(NEVER)


def schema_without(classes: Collection[type[BaseModel]]) -> type[GenerateJsonSchema]:
    """A schema generator leaving the models of *classes* out, for `model_json_schema(schema_generator=...)`."""
    left_out = frozenset(classes)

    class Without(GenerateJsonSchema):
        def model_schema(self, schema: core_schema.ModelSchema) -> JsonSchemaValue:
            return dict(NEVER) if schema["cls"] in left_out else super().model_schema(schema)

    return Without
