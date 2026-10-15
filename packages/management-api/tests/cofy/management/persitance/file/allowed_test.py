"""Which types communities may configure, as kept in the allowed file."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from cofy.management.domain.availability import Availability
from cofy.management.errors import StoredDataInvalidError
from cofy.management.persitance.file.allowed import FileAllowedPersistence


def allowed_file(tmp_path: Path, content: dict | None = None) -> Path:
    path = tmp_path / "access" / "allowed.yaml"
    if content is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump(content))
    return path


def stored(path: Path) -> dict:
    return yaml.safe_load(path.read_text())


def test_without_a_file_nothing_is_restricted(tmp_path: Path):
    allowed = FileAllowedPersistence(allowed_file(tmp_path))

    assert allowed.all() == {}
    assert allowed.get("resource", "tariff").allows("test")


def test_reads_the_availability_of_each_type_by_group(tmp_path: Path):
    path = allowed_file(
        tmp_path,
        {
            "module": {"billing": {"default": False, "exceptions": ["test"]}},
            "resource": {"tariff": {"default": False}},
        },
    )
    allowed = FileAllowedPersistence(path)

    assert allowed.all() == {
        "module": {"billing": Availability(default=False, exceptions=["test"])},
        "resource": {"tariff": Availability(default=False)},
    }


def test_putting_an_availability_creates_the_file_with_only_the_restricted_types(tmp_path: Path):
    path = allowed_file(tmp_path)
    allowed = FileAllowedPersistence(path)

    allowed.put("module", "billing", Availability(default=False, exceptions=["b", "a", "a"]))
    allowed.put("module", "tariff", Availability())
    allowed.put("source", "entsoe_day_ahead", Availability())

    assert stored(path) == {"module": {"billing": {"default": False, "exceptions": ["a", "b"]}}}


@pytest.mark.parametrize(
    ("availability", "allowed", "exceptions"),
    [
        (Availability(), False, ["test"]),
        (Availability(exceptions=["test"]), True, []),
        (Availability(default=False), True, ["test"]),
        (Availability(default=False, exceptions=["test"]), False, []),
        (Availability(default=False, exceptions=["test"]), True, ["test"]),
    ],
)
def test_allowing_a_type_to_one_community_keeps_its_default(
    tmp_path: Path, availability: Availability, allowed: bool, exceptions: list[str]
):
    persistence = FileAllowedPersistence(allowed_file(tmp_path))
    persistence.put("module", "billing", availability)

    stored = persistence.set_allowed("module", "billing", "test", allowed)

    assert stored == Availability(default=availability.default, exceptions=exceptions)
    assert persistence.get("module", "billing") == stored


def test_forgetting_a_community_drops_it_from_every_exception(tmp_path: Path):
    path = allowed_file(
        tmp_path,
        {
            "module": {"billing": {"default": False, "exceptions": ["gone", "kept"]}},
            "resource": {"tariff": {"default": True, "exceptions": ["gone"]}},
        },
    )

    FileAllowedPersistence(path).forget("gone")

    assert stored(path) == {"module": {"billing": {"default": False, "exceptions": ["kept"]}}}


def test_a_broken_file_is_reported_without_its_content(tmp_path: Path):
    path = allowed_file(tmp_path, {"module": {"billing": {"default": "secret-looking"}}})

    with pytest.raises(StoredDataInvalidError) as raised:
        FileAllowedPersistence(path).all()

    assert "secret-looking" not in str(raised.value)
