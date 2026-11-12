"""The management API's domain errors, sent as problem documents like every COFY error, see `cofy.api.errors`."""

from __future__ import annotations

from cofy.api import errors
from cofy.api.errors import CofyError, ExceptionHandlers, ValidationFailedError, problem
from fastapi import Request
from fastapi.responses import JSONResponse


class ForbiddenError(CofyError):
    status = 403
    title = "Forbidden"
    code = "forbidden"


class StoredDataInvalidError(CofyError):
    """Data kept on the server that can't be read, whose details are logged rather than sent to whoever asked."""

    status = 500
    title = "Internal Server Error"
    code = "stored-data-invalid"


class ResourceNotFoundError(CofyError):
    status = 404
    title = "Not Found"
    code = "resource-not-found"


class ResourceAlreadyExistsError(CofyError):
    status = 409
    title = "Conflict"
    code = "resource-already-exists"


class ResourceInUseError(CofyError):
    status = 409
    title = "Conflict"
    code = "resource-in-use"


class ResourceManagedError(CofyError):
    """Something a client looks after, which only that client changes."""

    status = 409
    title = "Conflict"
    code = "resource-managed"


async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
    # Domain invariants that are not tied to a single input field - a body whose identity
    # disagrees with its URL, a stored config that is not a mapping.
    return problem(422, ValidationFailedError.title, str(exc), ValidationFailedError.code)


EXCEPTION_HANDLERS: ExceptionHandlers = {**errors.EXCEPTION_HANDLERS, ValueError: handle_value_error}
"""COFY's problem+json handlers, plus one answering a `ValueError` as a failed validation."""
