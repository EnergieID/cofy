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

from ..errors import IdentityProviderUnavailableError
from ..persitance.users import UsersPersistence
from .access import Identity
from .config import OidcConfig


class HostTokens:
    """Access tokens from the login's identity provider, issued to the apps embedding the console."""

    def __init__(self, config: OidcConfig, users: UsersPersistence, http: httpx.Client | None = None):
        self.issuer = config.issuer
        self.metadata_url = config.server_metadata_url
        self.clients = frozenset(config.host_clients)
        self.users = users
        self.http = http or httpx.Client(timeout=5.0)
        self._userinfo_endpoint: str | None = None
        # By the token's hash, never the token itself, until it expires: the identity provider is asked once per token.
        self._identities: dict[str, tuple[Identity, float]] = {}

    def identity(self, token: str) -> Identity:
        """Who *token* was issued to, if it is a valid access token issued to one of the apps; refused otherwise.

        The first time a token is seen, its person is bound as at a login: an email granted access before is theirs.
        """
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
        info = self._userinfo(token)
        if info.get("sub") != claims.get("sub"):
            raise NotAuthenticatedError("Invalid token")
        identity = Identity.from_claims({**info, "iss": self.issuer})
        self.users.bind(identity)
        self._identities = {key: value for key, value in self._identities.items() if value[1] > now}
        self._identities[digest] = (identity, float(claims.get("exp", 0)))
        return identity

    def _userinfo(self, token: str) -> dict:
        try:
            if self._userinfo_endpoint is None:
                self._userinfo_endpoint = (
                    self.http.get(self.metadata_url).raise_for_status().json()["userinfo_endpoint"]
                )
            response = self.http.get(self._userinfo_endpoint, headers={"Authorization": f"Bearer {token}"})
        except httpx.HTTPError as exc:
            raise IdentityProviderUnavailableError("The identity provider can't be reached") from exc
        # Turned away - expired, revoked, or without the scope to ask - is a token that doesn't hold.
        if response.is_client_error:
            raise NotAuthenticatedError("Invalid token")
        if not response.is_success:
            raise IdentityProviderUnavailableError("The identity provider can't say who the token is for")
        return response.json()


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
