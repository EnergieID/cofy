import os

import httpx
from cofy.api import ModuleSettings, ResourceSettings, encrypt_secret
from fastapi import FastAPI
from pydantic import ValidationError

from .api.allowed import AllowedTypesRouter
from .api.catalog import CatalogRouter
from .api.communities import CommunitiesRouter
from .api.community_allowed_types import CommunityAllowedTypesRouter
from .api.grants import GrantsRouter, ManagedGrantsRouter
from .api.modules import ModulesRouter
from .api.resources import ResourcesRouter
from .api.secrets import SecretsRouter
from .api.status import StatusRouter
from .api.tokens import TokensRouter
from .auth.access import Subject
from .auth.config import OidcConfig
from .auth.host_tokens import HostTokens, install_host_tokens
from .auth.router import AuthRouter
from .auth.session import install_session
from .auth.user import install_users
from .community_api import CommunityApi
from .console_files import ConsoleFiles
from .cors import install_cors
from .domain.allowed import AllowedTypes
from .errors import EXCEPTION_HANDLERS
from .persitance.file.allowed import FileAllowedPersistence
from .persitance.file.base import data_dir
from .persitance.file.communities import FileCommunitiesPersistence
from .persitance.file.grants import FileGrantsPersistence
from .persitance.file.modules import FileModulesPersistence
from .persitance.file.resources import FileResourcesPersistence
from .persitance.file.secrets import FileSecretsPersistence
from .persitance.file.tokens import FileTokensPersistence
from .persitance.file.users import FileUsersPersistence

STATIC_DIR_ENV_VAR = "COFY_MANAGEMENT_STATIC_DIR"
COMMUNITIES_URL_ENV_VAR = "COFY_MANAGEMENT_COMMUNITIES_URL"
ENCRYPTION_KEY_ENV_VAR = "COFY_MANAGEMENT_SECRETS_ENCRYPTION_KEY"
CORS_ORIGINS_ENV_VAR = "COFY_MANAGEMENT_CORS_ORIGINS"

#: Each `OidcConfig` field, and the environment variable it is read from.
OIDC_ENV_VARS = {
    "issuer": "COFY_MANAGEMENT_OIDC_ISSUER",
    "client_id": "COFY_MANAGEMENT_OIDC_CLIENT_ID",
    "client_secret": "COFY_MANAGEMENT_OIDC_CLIENT_SECRET",
    "scopes": "COFY_MANAGEMENT_OIDC_SCOPES",
    "session_secret": "COFY_MANAGEMENT_SESSION_SECRET",
    "session_lifetime": "COFY_MANAGEMENT_SESSION_LIFETIME",
    "secure_cookies": "COFY_MANAGEMENT_SECURE_COOKIES",
    "host_clients": "COFY_MANAGEMENT_HOST_CLIENTS",
}


def oidc_config_from_env() -> OidcConfig:
    """The login configuration, from the environment; there is no running without one."""
    values: dict[str, object] = {field: os.environ[var] for field, var in OIDC_ENV_VARS.items() if os.environ.get(var)}
    if "host_clients" in values:
        values["host_clients"] = _comma_separated(OIDC_ENV_VARS["host_clients"])
    try:
        return OidcConfig.model_validate(values)
    except ValidationError as exc:
        fields = ", ".join(OIDC_ENV_VARS[str(error["loc"][0])] for error in exc.errors())
        raise RuntimeError(f"Login is not configured correctly, check {fields}") from exc


def community_api_from_env() -> CommunityApi:
    """The communities' APIs, served each under its slug at the URL in the environment."""
    url = os.environ.get(COMMUNITIES_URL_ENV_VAR)
    if not url:
        raise RuntimeError(f"{COMMUNITIES_URL_ENV_VAR} must be set to where the communities' APIs are served")
    # Short, so an API that hangs is reported unavailable rather than making the console slow.
    return CommunityApi(httpx.Client(base_url=url, timeout=2.0))


def encryption_key_from_env() -> str:
    """The public key the communities' secrets are encrypted with; they are never stored otherwise."""
    key = os.environ.get(ENCRYPTION_KEY_ENV_VAR, "")
    try:
        encrypt_secret("", key)
    except ValueError as exc:
        raise RuntimeError(f"{ENCRYPTION_KEY_ENV_VAR} must be set to the public key from `generate_keypair`") from exc
    return key


def _comma_separated(var: str) -> list[str]:
    return [value.strip() for value in os.environ.get(var, "").split(",") if value.strip()]


def cors_origins_from_env() -> list[str]:
    """The sites of apps embedding the console, which call the API from their own pages; none by default."""
    return _comma_separated(CORS_ORIGINS_ENV_VAR)


oidc_config = oidc_config_from_env()
community_api = community_api_from_env()
encryption_key = encryption_key_from_env()
users_file = data_dir() / "access" / "users.yaml"
users = FileUsersPersistence(users_file)
grants = FileGrantsPersistence(users_file)
allowed_types = FileAllowedPersistence(data_dir() / "access" / "allowed.yaml")
allowed = AllowedTypes(allowed_types)

app = FastAPI(
    title="COFY Management API",
    version="0.1.0",
    description="Management API for COFY",
    exception_handlers=EXCEPTION_HANDLERS,
)
install_session(app, oidc_config)
install_users(app, users)
if oidc_config.host_clients:
    install_host_tokens(app, HostTokens(oidc_config, users))
# Last, so it runs first, around the console's files too: a host loads `embed.js` from its own pages.
install_cors(app, cors_origins_from_env())

app.include_router(AuthRouter(oidc_config, users, FileCommunitiesPersistence()).router)
app.include_router(CommunitiesRouter(FileCommunitiesPersistence(), grants, allowed_types, community_api).router)
app.include_router(ModulesRouter(FileModulesPersistence(), allowed).router)
app.include_router(
    CatalogRouter(allowed, ModuleSettings, subject=Subject.modules, path="modules", tag="Module catalog").router
)
app.include_router(
    CatalogRouter(allowed, ResourceSettings, subject=Subject.resources, path="resources", tag="Resource catalog").router
)
app.include_router(AllowedTypesRouter(allowed, FileCommunitiesPersistence()).router)
app.include_router(CommunityAllowedTypesRouter(allowed, FileCommunitiesPersistence()).router)
app.include_router(ResourcesRouter(FileResourcesPersistence(), FileModulesPersistence(), allowed).router)
app.include_router(
    SecretsRouter(FileSecretsPersistence(), FileModulesPersistence(), FileResourcesPersistence(), encryption_key).router
)
app.include_router(TokensRouter(FileTokensPersistence()).router)
app.include_router(GrantsRouter(grants, FileCommunitiesPersistence()).router)
app.include_router(ManagedGrantsRouter(grants, FileCommunitiesPersistence()).router)
app.include_router(StatusRouter(FileCommunitiesPersistence(), community_api).router)

# Serving the console's built files is optional and off by default, so the API stays usable
# on its own (e.g. behind the Vite dev server's proxy). A deployment that wants a single
# origin - so the console's API client needs no base URL and there is no CORS to configure -
# sets this to the console's build output; it is mounted last so it never shadows the routers
# above, and answers every path of the console's own with its page, which routes itself.
static_dir = os.environ.get(STATIC_DIR_ENV_VAR)
if static_dir:
    app.mount("/", ConsoleFiles(static_dir), name="console")
