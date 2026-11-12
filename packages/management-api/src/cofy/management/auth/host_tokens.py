"""Logging in as whoever an app embedding the console has logged in, with that app's own access token.

The app logs its users in at the same identity provider as this API, so a token it was issued says who they are. Only
tokens issued to the apps listed are taken, as any other client of the provider could get one for its own users too.
"""

from __future__ import annotations

import base64
import hashlib
import json
import time

import httpx
from cofy.api.errors import NotAuthenticatedError
from fastapi import FastAPI, Request

from .access import Identity
from .config import OidcConfig


class HostTokens:
    """Access tokens from the login's identity provider, issued to the apps embedding the console."""

    def __init__(self, config: OidcConfig, http: httpx.AsyncClient | None = None):
        self.issuer = config.issuer
        self.metadata_url = config.server_metadata_url
        self.clients = frozenset(config.host_clients)
        self.http = http or httpx.AsyncClient(timeout=5.0)
        self._userinfo_endpoint: str | None = None
        # By the token's hash, never the token itself, until it expires: the identity provider is asked once per token.
        self._identities: dict[str, tuple[Identity, float]] = {}

    async def identity(self, token: str) -> Identity:
        """Who *token* was issued to, if it is a valid access token issued to one of the apps; refused otherwise."""
        digest = hashlib.sha256(token.encode()).hexdigest()
        now = time.time()
        cached = self._identities.get(digest)
        if cached is not None and cached[1] > now:
            return cached[0]
        claims = _unverified_claims(token)
        # Checked before the token goes anywhere: the identity provider only ever sees its own tokens, of the apps.
        if claims.get("iss") != self.issuer or claims.get("client_id") not in self.clients:
            raise NotAuthenticatedError("Invalid token")
        # The identity provider only answers for a token it issued that still holds - signed, not expired - which
        # vouches for the claims read above too.
        response = await self.http.get(await self._userinfo(), headers={"Authorization": f"Bearer {token}"})
        if response.status_code == httpx.codes.UNAUTHORIZED:
            raise NotAuthenticatedError("Invalid token")
        response.raise_for_status()
        info = response.json()
        if info.get("sub") != claims.get("sub"):
            raise NotAuthenticatedError("Invalid token")
        identity = Identity(
            issuer=self.issuer,
            subject=info["sub"],
            email=info.get("email"),
            email_verified=info.get("email_verified") in (True, "true"),
            name=info.get("name"),
        )
        self._identities = {key: value for key, value in self._identities.items() if value[1] > now}
        self._identities[digest] = (identity, float(claims.get("exp", 0)))
        return identity

    async def _userinfo(self) -> str:
        if self._userinfo_endpoint is None:
            response = await self.http.get(self.metadata_url)
            response.raise_for_status()
            self._userinfo_endpoint = response.json()["userinfo_endpoint"]
        return self._userinfo_endpoint


def _unverified_claims(token: str) -> dict:
    """The claims of JWT *token*, as it says them: to be checked by whoever can."""
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError):
        return {}
    return claims if isinstance(claims, dict) else {}


def install_host_tokens(app: FastAPI, tokens: HostTokens) -> None:
    """Have *app* take the access tokens of the apps embedding the console."""
    app.state.host_tokens = tokens


def host_tokens(request: Request) -> HostTokens | None:
    return getattr(request.app.state, "host_tokens", None)
