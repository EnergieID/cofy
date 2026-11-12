"""Calls from apps embedding the console, on their own sites."""

from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware


def install_cors(app: FastAPI, origins: list[str]) -> None:
    """Let pages on *origins* call *app* and load its files.

    Without cookies: such a page logs in with its own access token, so the session cookie stays same-site, which is
    what keeps other sites from acting on a user's behalf with it.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )
