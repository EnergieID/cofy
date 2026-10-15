import logging
from collections.abc import Generator
from contextlib import ExitStack, contextmanager
from pathlib import Path
from typing import Literal

import yaml
from pydantic import ConfigDict, RootModel

from ...domain.availability import Availability
from ...errors import StoredDataInvalidError
from ..allowed import AllowedPersistence
from .base import FileStore

logger = logging.getLogger(__name__)


class AllowedFile(RootModel[dict[str, dict[str, Availability]]]):
    """The availability of every restricted type, by group and name, as stored; a type it doesn't list is available
    everywhere."""

    model_config = ConfigDict(hide_input_in_errors=True)

    root: dict[str, dict[str, Availability]] = {}


class FileAllowedPersistence(FileStore[AllowedFile], AllowedPersistence):
    """The allowed file, which lists every restricted type; without it, every community may configure every type."""

    document = AllowedFile

    def __init__(self, path: Path):
        self.path = path

    def all(self) -> dict[str, dict[str, Availability]]:
        with self._open_allowed("read") as allowed:
            return allowed.root

    def put(self, group: str, name: str, availability: Availability) -> Availability:
        with self._open_allowed("write") as allowed:
            allowed.root.setdefault(group, {})[name] = availability
            return availability

    def set_allowed(self, group: str, name: str, slug: str, allowed: bool) -> Availability:
        with self._open_allowed("write") as stored:
            types = stored.root.setdefault(group, {})
            types[name] = types.get(name, Availability()).allowing(slug, allowed)
            return types[name]

    def forget(self, slug: str) -> None:
        with self._open_allowed("write") as allowed:
            for types in allowed.root.values():
                for name, availability in types.items():
                    # No longer an exception, whichever way it was one.
                    types[name] = availability.allowing(slug, availability.default)

    def _serialize(self, document: AllowedFile) -> str:
        # Only the types someone restricted, as someone would write them by hand.
        listed = {
            group: {
                name: availability.model_dump(mode="json")
                for name, availability in sorted(types.items())
                if not availability.is_default()
            }
            for group, types in sorted(document.root.items())
        }
        return yaml.safe_dump({group: types for group, types in listed.items() if types}, sort_keys=False)

    @contextmanager
    def _open_allowed(self, mode: Literal["read", "write"]) -> Generator[AllowedFile]:
        """The allowed file for a read or a read-modify-write; a write creates it if it is missing."""
        if mode == "read" and not self.path.exists():
            yield AllowedFile()
            return
        with ExitStack() as stack:
            try:
                allowed = stack.enter_context(self._open_document(self.path, mode, create=mode == "write"))
            except (ValueError, yaml.YAMLError) as exc:
                logger.error("The allowed file at %s can't be read: %s", self.path, exc)
                raise StoredDataInvalidError(
                    "Which types may be used can't be read; it has to be fixed on the server"
                ) from exc
            yield allowed
