"""The website's contact form endpoint: a Scaleway serverless function that emails each message on."""

import base64
import json
import os
import re
import urllib.error
import urllib.request

TEM_URL = "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails"

ROLES = {"supplier", "community", "self-host", "other"}
# One address, no whitespace or line breaks: it ends up in a Reply-To header.
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LIMITS = {"name": 200, "email": 320, "organisation": 200, "message": 5000}


def handle(event, context):
    if event.get("method") == "OPTIONS":
        return _response(204)
    if event.get("method") != "POST":
        return _response(405, {"error": "method_not_allowed"})

    try:
        form = _parse(event)
    except ValueError:
        return _response(400, {"error": "invalid_body"})

    # The honeypot: a field people never see, so only bots fill it in. They get the same answer as people.
    if form.get("website"):
        return _response(200, {"ok": True})

    problems = _validate(form)
    if problems:
        return _response(400, {"error": "invalid_fields", "fields": problems})

    try:
        _send(form)
    except (urllib.error.URLError, TimeoutError):
        return _response(502, {"error": "send_failed"})
    return _response(200, {"ok": True})


def _parse(event) -> dict[str, str]:
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode()
    form = json.loads(body)
    if not isinstance(form, dict):
        raise ValueError("body is not an object")
    return {key: str(value).strip() for key, value in form.items() if isinstance(value, str)}


def _validate(form: dict[str, str]) -> list[str]:
    problems = [field for field, limit in LIMITS.items() if len(form.get(field, "")) > limit]
    problems += [field for field in ("name", "message") if not form.get(field)]
    if not EMAIL.match(form.get("email", "")):
        problems.append("email")
    if form.get("role", "other") not in ROLES:
        problems.append("role")
    return sorted(set(problems))


def _send(form: dict[str, str]) -> None:
    text = "\n".join(
        [
            f"Name: {form['name']}",
            f"Email: {form['email']}",
            f"Organisation: {form.get('organisation') or '-'}",
            f"Role: {form.get('role', 'other')}",
            "",
            form["message"],
        ]
    )
    email = {
        "from": {"email": os.environ["CONTACT_FROM"], "name": "Cofy website"},
        "to": [{"email": os.environ["CONTACT_TO"]}],
        "subject": f"Cofy website: message from {form['name']}",
        "text": text,
        "project_id": os.environ["TEM_PROJECT_ID"],
        "additional_headers": [{"key": "Reply-To", "value": form["email"]}],
    }
    request = urllib.request.Request(
        TEM_URL,
        data=json.dumps(email).encode(),
        headers={"Content-Type": "application/json", "X-Auth-Token": os.environ["TEM_SECRET_KEY"]},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10):
        pass


def _response(status: int, body: dict | None = None) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "https://cofy.cloud"),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body) if body is not None else "",
    }
