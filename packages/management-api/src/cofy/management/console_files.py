"""Serving the console's built files, beside the API."""

from __future__ import annotations

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

PAGES = "console"
"""Where the console's own pages are, which it routes itself: apart from the communities' APIs, which a deployment
serves at `/communities/<slug>/` on the same site."""


class ConsoleFiles(StaticFiles):
    """The console's files, and its page at the site's root and for every path of its own pages."""

    def __init__(self, directory: str):
        super().__init__(directory=directory, html=True)

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or not (path == PAGES or path.startswith(f"{PAGES}/")):
                raise
            return await super().get_response("index.html", scope)
