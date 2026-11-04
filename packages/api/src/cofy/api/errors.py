"""Errors with a defined HTTP representation, sent as RFC 9457 `application/problem+json` documents."""

import logging
from collections.abc import Callable, Coroutine, Mapping
from http import HTTPStatus
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from opentelemetry import trace
from pydantic import BaseModel
from starlette.exceptions import HTTPException

LOGGER = logging.getLogger(__name__)

ExceptionHandlers = dict[int | type[Exception], Callable[[Request, Any], Coroutine[Any, Any, Response]]]
"""Exception handlers by the exception class or status code they handle, as FastAPI takes them."""

CONTENT_TYPE = "application/problem+json"


class ProblemFieldError(BaseModel):
    """One failure attributable to a part of the request."""

    loc: list[str | int]
    msg: str
    type: str


class ProblemDetails(BaseModel):
    """An RFC 9457 problem document.

    `code` names the failure in a way a client can act on - to translate it, or to branch on
    it - where `title` and `detail` are English prose meant for a person. It takes the place
    RFC 9457's `type` would have: that member is a URI, and inventing one that resolves to
    nothing helps nobody.
    """

    title: str
    status: int
    detail: str
    code: str
    errors: list[ProblemFieldError] | None = None


class CofyError(Exception):
    """A failure with a defined HTTP representation.

    Subclasses set `status`, `title` and `code`, and are raised with a message that becomes the
    problem document's `detail`, so it is shown to whoever made the request.
    """

    status: int = 500
    title: str = "Internal Server Error"
    code: str = "internal-error"

    @property
    def errors(self) -> list[ProblemFieldError]:
        """The parts of the request that caused this failure."""
        return []


class NotAuthenticatedError(CofyError):
    status = 401
    title = "Unauthorized"
    code = "not-authenticated"


class NotFoundError(CofyError):
    status = 404
    title = "Not Found"
    code = "not-found"


class ValidationFailedError(CofyError, ValueError):
    """A request that can't be served as asked, which the caller can fix."""

    status = 422
    title = "Unprocessable Content"
    code = "validation-failed"

    def __init__(self, detail: str, loc: tuple[str | int, ...] | None = None):
        """A failed request, caused by the part of it at `loc`, e.g. `("query", "resolution")`, if given."""
        super().__init__(detail)
        self.loc = loc

    @property
    def errors(self) -> list[ProblemFieldError]:
        if self.loc is None:
            return []
        return [ProblemFieldError(loc=list(self.loc), msg=str(self), type="value_error")]


class SourceError(CofyError):
    """A source that failed to deliver its data, which the caller can't fix."""

    status = 502
    title = "Bad Gateway"
    code = "source-failed"


class SourceUnauthorizedError(SourceError):
    """A source whose credentials don't give it access: refused by the service it fetches from, or unreadable."""

    code = "source-unauthorized"


def problem(
    status: int,
    title: str,
    detail: str,
    code: str,
    errors: list[ProblemFieldError] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """Build a problem+json response."""
    body = ProblemDetails(title=title, status=status, detail=detail, code=code, errors=errors or None)
    return JSONResponse(
        status_code=status, content=body.model_dump(exclude_none=True), headers=headers, media_type=CONTENT_TYPE
    )


def problem_response(description: str) -> dict[str, Any]:
    """An OpenAPI response of a problem document, for a route's `responses`."""
    return {"description": description, "model": ProblemDetails}


async def handle_cofy_error(request: Request, exc: CofyError) -> JSONResponse:
    if exc.status >= 500:
        LOGGER.error("%s: %s", exc.code, exc, exc_info=exc)
        trace.get_current_span().record_exception(exc)
    return problem(exc.status, exc.title, str(exc), exc.code, exc.errors)


async def handle_request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # `loc` is passed through as pydantic reports it, and `type` with it: that is pydantic's
    # own stable code for the failure, which is what lets a client translate the message
    # rather than show this English one. `input` is dropped: it echoes the submitted value,
    # which for a credential field would put the secret in the response.
    errors = [ProblemFieldError(loc=list(e["loc"]), msg=e["msg"], type=e["type"]) for e in exc.errors()]
    return problem(
        ValidationFailedError.status,
        ValidationFailedError.title,
        "Request validation failed.",
        ValidationFailedError.code,
        errors,
    )


async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    # Raised by FastAPI itself, for a path or method that doesn't exist, and by third-party code.
    phrase = HTTPStatus(exc.status_code).phrase
    return problem(exc.status_code, phrase, str(exc.detail), phrase.lower().replace(" ", "-"), headers=exc.headers)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Its message may hold anything, an upstream URL with its key included, so it is only logged.
    return problem(500, CofyError.title, "An unexpected error occurred.", CofyError.code)


EXCEPTION_HANDLERS: ExceptionHandlers = {
    CofyError: handle_cofy_error,
    RequestValidationError: handle_request_validation_error,
    HTTPException: handle_http_exception,
    Exception: handle_unexpected_error,
}
"""The handlers answering every failure with a problem document, by the exception class they handle."""
