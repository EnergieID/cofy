"""Logged-in users and clients for tests, standing in for a login through the identity provider or an API key."""

from __future__ import annotations

from cofy.api import hash_key
from fastapi import FastAPI

from cofy.management.auth.access import ClientRecord, GlobalRole, Identity, Role, UserRecord
from cofy.management.auth.config import OidcConfig
from cofy.management.auth.user import Client, Principal, User, current_principal

ISSUER = "https://identity.example"

OIDC_CONFIG = OidcConfig(
    issuer=ISSUER,
    client_id="cofy-management",
    client_secret="client-secret",
    session_secret="session-secret",
    secure_cookies=False,
)


def identity(name: str) -> Identity:
    return Identity(issuer=ISSUER, subject=f"{name}-sub", email=f"{name}@example.com", email_verified=True, name=name)


def log_in(app: FastAPI, user: Principal) -> None:
    """Have every request to *app* made by *user*."""
    app.dependency_overrides[current_principal] = lambda: user


def user(
    name: str,
    *,
    system_admin: bool = False,
    roles: list[GlobalRole] | None = None,
    grants: dict[str, Role] | None = None,
) -> User:
    """*name* logged in, as the users file would have them."""
    record = UserRecord(email=f"{name}@example.com", issuer=ISSUER, subject=f"{name}-sub", system_admin=system_admin)
    record.roles = roles or []
    record.grants = grants or {}
    return User(identity(name), record)


def log_in_as_system_admin(app: FastAPI) -> None:
    log_in(app, user("admin", system_admin=True))


def client_record(
    name: str = "energyid", *, roles: list[GlobalRole] | None = None, grants: dict[str, Role] | None = None
) -> ClientRecord:
    """*name* as the users file would list it, with `<name>-key` as its API key."""
    return ClientRecord(name=name, hash=hash_key(f"{name}-key"), roles=roles or [], grants=grants or {})


def api_client(
    name: str = "energyid", *, roles: list[GlobalRole] | None = None, grants: dict[str, Role] | None = None
) -> Client:
    """*name* asking with its API key."""
    return Client(client_record(name, roles=roles, grants=grants))
