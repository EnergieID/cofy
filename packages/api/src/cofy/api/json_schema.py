"""JSON Schemas of settings leaving out some types, as they are generated.

A type is left out of every discriminated union offering it, and so a field whose union has nothing left to offer is
left out of the union around it. Where that union is a referable field's - its value, or a reference to a resource -
only the reference remains.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping
from typing import Any, cast

from pydantic import BaseModel
from pydantic.json_schema import GenerateJsonSchema, JsonSchemaValue
from pydantic_core import core_schema


def schema_without(classes: Collection[type[BaseModel]]) -> type[GenerateJsonSchema]:
    """A schema generator leaving the models of *classes* out, for `model_json_schema(schema_generator=...)`."""
    refs = frozenset(_ref(cls) for cls in classes)

    class Without(GenerateJsonSchema):
        def tagged_union_schema(self, schema: core_schema.TaggedUnionSchema) -> JsonSchemaValue:
            kept = {tag: choice for tag, choice in schema["choices"].items() if not _left_out(choice, refs)}
            return super().tagged_union_schema({**schema, "choices": kept})

    return Without


def _ref(cls: type[BaseModel]) -> str:
    """The reference under which *cls* appears in the core schemas holding it."""
    schema = cast(Mapping[str, Any], cls.__pydantic_core_schema__)
    while "ref" not in schema:
        schema = schema["schema"]
    return schema["ref"]


def _left_out(schema: Mapping[str, Any], refs: frozenset[str]) -> bool:
    """Whether *schema* is one of the models of *refs*, or a union of nothing else."""
    if schema["type"] == "definition-ref":
        return schema["schema_ref"] in refs
    if schema["type"] == "tagged-union":
        return all(_left_out(choice, refs) for choice in schema["choices"].values())
    if schema.get("ref") in refs:
        return True
    # A model wrapped in validators is still that model.
    return schema["type"].startswith("function-") and "schema" in schema and _left_out(schema["schema"], refs)
