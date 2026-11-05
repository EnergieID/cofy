"""Secrets: credentials configured once in a community's secrets, and referenced by name wherever one is needed."""

from __future__ import annotations

import base64
from typing import Annotated, Any, Literal, Self

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hpke
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    PrivateAttr,
    SecretStr,
    SerializationInfo,
    ValidationInfo,
    model_validator,
)

from .references import NamedRef

NAME_PATTERN = r"^[a-zA-Z0-9_-]+$"

DECRYPTION_KEY = "decryption_key"
"""The validation context entry holding the private key that encrypted secrets are decrypted with."""

_SUITE = hpke.Suite(hpke.KEM.X25519, hpke.KDF.HKDF_SHA256, hpke.AEAD.AES_256_GCM)
_INFO = b"cofy secret"


def generate_keypair() -> tuple[str, str]:
    """A new private key to decrypt secrets with, and the public key to encrypt them with, both base64."""
    private_key = X25519PrivateKey.generate()
    return (
        base64.b64encode(private_key.private_bytes_raw()).decode(),
        base64.b64encode(private_key.public_key().public_bytes_raw()).decode(),
    )


def encrypt_secret(value: str, public_key: str) -> str:
    """*value* encrypted with *public_key*, as base64, for a secret's `encrypted`."""
    key = X25519PublicKey.from_public_bytes(base64.b64decode(public_key, validate=True))
    return base64.b64encode(_SUITE.encrypt(value.encode(), key, info=_INFO)).decode()


def decrypt_secret(encrypted: str, private_key: str) -> str:
    """The value *encrypted* was made from, with the private key of the public key it was encrypted with."""
    key = X25519PrivateKey.from_private_bytes(base64.b64decode(private_key, validate=True))
    return _SUITE.decrypt(base64.b64decode(encrypted, validate=True), key, info=_INFO).decode()


def _dump_value(value: SecretStr, info: SerializationInfo) -> str:
    # `round_trip=True` marks the serialization that is written to disk, the only place the value belongs.
    return value.get_secret_value() if info.round_trip else str(value)


SecretValue = Annotated[SecretStr, PlainSerializer(_dump_value, return_type=str, when_used="always")]
"""A secret's value itself, only revealed when its configuration is written to disk."""


class SecretSettings(BaseModel):
    """A named credential, given as its value or encrypted."""

    name: str = Field(description="The machine name of the secret, by which it is referenced.", pattern=NAME_PATTERN)
    description: str | None = Field(None, description="A short description of the secret.")
    value: SecretValue | None = Field(None, description="The secret itself.")
    encrypted: str | None = Field(None, description="The secret, encrypted with `encrypt_secret`.")

    # From the validation context, so the key never becomes part of the settings.
    _decryption_key: str | None = PrivateAttr(default=None)

    @model_validator(mode="after")
    def _check_value_or_encrypted(self, info: ValidationInfo) -> Self:
        if (self.value is None) == (self.encrypted is None):
            raise ValueError(f"Secret {self.name!r} needs either a value or an encrypted value")
        self._decryption_key = (info.context or {}).get(DECRYPTION_KEY)
        return self

    def resolve(self) -> str:
        """The secret's actual value."""
        if self.value is not None:
            return self.value.get_secret_value()
        assert self.encrypted is not None
        if self._decryption_key is None:
            raise ValueError(f"Secret {self.name!r} is encrypted, but no key was given to decrypt it with")
        try:
            return decrypt_secret(self.encrypted, self._decryption_key)
        # Raised without its cause, which could only point at the key or the ciphertext.
        except (InvalidTag, ValueError):
            raise ValueError(f"Secret {self.name!r} cannot be decrypted with the given key") from None


def _secret_schema(schema: dict[str, Any]) -> None:
    # Marked for forms to offer the community's secrets, and without a title or description of its own, which would
    # stand in for those of the field it's in.
    schema.pop("title", None)
    schema.pop("description", None)
    schema["x-secret"] = True


class SecretRef(NamedRef):
    """A settings field holding a credential, as a reference to the secret holding it."""

    model_config = ConfigDict(json_schema_extra=_secret_schema)

    type: Literal["secret"] = "secret"
    name: str = Field(description="The name of the referenced secret.", pattern=NAME_PATTERN)


Secret = SecretRef
"""A settings field holding a credential, as a reference to the secret holding it."""
