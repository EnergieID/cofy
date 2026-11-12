"""Being served at more than one URL: directly, and through reverse proxies that serve the API and console under a path
of their own site, as an app embedding the console does."""

from __future__ import annotations

from urllib.parse import SplitResult, urlsplit

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

PREFIX_HEADER = "x-forwarded-prefix"


def _parse(url: str) -> SplitResult:
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.path.rstrip("/") == "":
        raise ValueError(f"{url!r} must be an http(s) URL with a path, such as https://app.example/cofy")
    return parsed


class ProxiedUrls:
    """Answers a request a proxy forwards as made to the URL that proxy serves this at, for the URLs to log in and
    out at to be on the proxy's site.

    A proxy tells which URL by the path it serves this under, in `X-Forwarded-Prefix`; it may strip that prefix from
    the request's path or not. Only the configured URLs are honoured, so a request can't claim to be anywhere else.
    """

    def __init__(self, app: ASGIApp, urls: list[str]):
        self.app = app
        self.urls: dict[str, SplitResult] = {}
        for url in urls:
            parsed = _parse(url)
            prefix = parsed.path.rstrip("/")
            if prefix in self.urls:
                raise ValueError(f"Each proxied URL needs a path of its own, but {prefix!r} is used twice")
            self.urls[prefix] = parsed

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            prefix = Headers(scope=scope).get(PREFIX_HEADER, "").rstrip("/")
            url = self.urls.get(prefix)
            if url is not None:
                scope = self._at(scope, prefix, url)
        await self.app(scope, receive, send)

    @staticmethod
    def _at(scope: Scope, prefix: str, url: SplitResult) -> Scope:
        path: str = scope["path"]
        default_port = 443 if url.scheme == "https" else 80
        return {
            **scope,
            "scheme": url.scheme,
            "server": (url.hostname, url.port or default_port),
            "headers": [(name, value) for name, value in scope["headers"] if name != b"host"]
            + [(b"host", url.netloc.encode("latin-1"))],
            "root_path": prefix,
            "path": path if path == prefix or path.startswith(f"{prefix}/") else f"{prefix}{path}",
        }
