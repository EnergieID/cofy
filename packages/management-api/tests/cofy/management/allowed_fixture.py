"""Which types communities may configure, for tests, kept beside the data they use."""

from __future__ import annotations

from pathlib import Path

from cofy.api import ModuleSettings, ResourceSettings
from fastapi import FastAPI

from cofy.management.api.catalog import CatalogRouter
from cofy.management.auth.access import Subject
from cofy.management.domain.allowed import AllowedTypes
from cofy.management.persitance.file.allowed import FileAllowedPersistence


def allowed_types_in(data: Path) -> FileAllowedPersistence:
    return FileAllowedPersistence(data / "access" / "allowed.yaml")


def allowed_in(data: Path) -> AllowedTypes:
    return AllowedTypes(allowed_types_in(data))


def include_catalogs(app: FastAPI, allowed: AllowedTypes) -> None:
    """Have *app* serve the module and resource catalogs, as the management API does."""
    app.include_router(
        CatalogRouter(allowed, ModuleSettings, subject=Subject.modules, path="modules", tag="Module catalog").router
    )
    app.include_router(
        CatalogRouter(
            allowed, ResourceSettings, subject=Subject.resources, path="resources", tag="Resource catalog"
        ).router
    )
