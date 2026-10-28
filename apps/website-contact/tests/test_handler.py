import base64
import json
import urllib.error

import pytest

import handler

VALID = {"name": "Ada", "email": "ada@example.org", "organisation": "Klimaan", "role": "community", "message": "Hi"}


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("CONTACT_FROM", "noreply@cofy.cloud")
    monkeypatch.setenv("CONTACT_TO", "team@example.org")
    monkeypatch.setenv("TEM_PROJECT_ID", "project")
    monkeypatch.setenv("TEM_SECRET_KEY", "secret")
    monkeypatch.setenv("ALLOWED_ORIGIN", "https://cofy.cloud")


@pytest.fixture
def sent(monkeypatch):
    requests = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def urlopen(request, timeout):
        requests.append(request)
        return Response()

    monkeypatch.setattr(handler.urllib.request, "urlopen", urlopen)
    return requests


def post(body, **event):
    return handler.handle({"method": "POST", "body": json.dumps(body), **event}, {})


def test_sends_the_message_with_the_visitor_as_reply_to(sent):
    response = post(VALID)

    assert response["statusCode"] == 200
    email = json.loads(sent[0].data)
    assert email["to"] == [{"email": "team@example.org"}]
    assert email["from"]["email"] == "noreply@cofy.cloud"
    assert email["additional_headers"] == [{"key": "Reply-To", "value": "ada@example.org"}]
    assert "Klimaan" in email["text"] and "Hi" in email["text"]
    assert sent[0].get_header("X-auth-token") == "secret"


def test_never_reveals_the_recipient(sent):
    response = post(VALID)

    assert "team@example.org" not in json.dumps(response)


def test_reads_a_base64_body(sent):
    body = base64.b64encode(json.dumps(VALID).encode()).decode()

    response = handler.handle({"method": "POST", "body": body, "isBase64Encoded": True}, {})

    assert response["statusCode"] == 200


def test_answers_a_preflight_with_cors_headers():
    response = handler.handle({"method": "OPTIONS"}, {})

    assert response["statusCode"] == 204
    assert response["headers"]["Access-Control-Allow-Origin"] == "https://cofy.cloud"


def test_refuses_other_methods():
    assert handler.handle({"method": "GET"}, {})["statusCode"] == 405


@pytest.mark.parametrize("body", ["not json", "[1, 2]"])
def test_refuses_a_body_that_is_not_an_object(body):
    assert handler.handle({"method": "POST", "body": body}, {})["statusCode"] == 400


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"name": ""}, "name"),
        ({"message": ""}, "message"),
        ({"email": "not-an-address"}, "email"),
        ({"email": "ada@example.org\nBcc: x@example.org"}, "email"),
        ({"role": "admin"}, "role"),
        ({"message": "x" * 5001}, "message"),
    ],
)
def test_refuses_invalid_fields(sent, change, field):
    response = post({**VALID, **change})

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["fields"] == [field]
    assert sent == []


def test_quietly_drops_what_fills_the_honeypot(sent):
    response = post({**VALID, "website": "https://spam.example"})

    assert response["statusCode"] == 200
    assert sent == []


def test_reports_a_failed_send(monkeypatch):
    def urlopen(request, timeout):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(handler.urllib.request, "urlopen", urlopen)

    assert post(VALID)["statusCode"] == 502
