"""Build explicitly; validate read-only. No dependency on application models."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import re
import runpy
import shutil
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal

import pytest
from pydantic import JsonValue

ROOT = Path(__file__).resolve().parents[2]
FARM_ID = "faisalabad_2025"
LOCATION = {"latitude": 31.4504, "longitude": 73.1350}
MANIFEST_PATH = "backend/tests/fixtures/manifest.json"
CATALOG_PATH = "backend/data/punjab_crops.json"
PROVIDERS = ("power", "smap", "soilgrids")
ARCHIVE_KEYS = {
    "power": {"schema_version", "provider", "farm_id", "location", "requests"},
    "soilgrids": {
        "schema_version",
        "provider",
        "farm_id",
        "location",
        "acquisition",
        "retrieved_at",
        "product",
        "source_urls",
        "available",
        "unavailable_reason",
        "layers",
    },
    "smap": {
        "schema_version",
        "provider",
        "farm_id",
        "location",
        "product",
        "version",
        "cell_id",
        "grid_posting_km",
        "retrieved_at",
        "granule_ids",
        "available",
        "unavailable_reason",
        "rows",
        "reference_rows",
    },
}
PINNED_MANIFEST = {
    "schema_version": "fixture-1",
    "fixture_id": FARM_ID,
    "farm_id": FARM_ID,
    "location": LOCATION,
    "assessment_end": "2025-10-15",
    "slots": [{"slot_id": "rabi_2025", "start_date": "2025-11-01", "end_date": "2026-03-31"}],
    "transform_version": "features-v1",
    "synthetic": False,
}


@dataclass(frozen=True)
class FixtureFile:
    provider: Literal["power", "soilgrids", "smap"]
    path: str
    sha256: str
    available: bool

    def __post_init__(self) -> None:
        if (
            self.provider not in PROVIDERS
            or self.path != f"backend/tests/fixtures/{self.provider}_archive.json"
        ):
            raise ValueError("Wrong provider/path association")
        if not isinstance(self.sha256, str) or re.fullmatch(r"[0-9a-f]{64}", self.sha256) is None:
            raise ValueError("Expected lowercase SHA-256")
        if type(self.available) is not bool:
            raise ValueError("Availability must be boolean")


def _confined_file(root: Path, relative: str) -> Path:
    base = root.resolve(strict=True)
    path = base
    for part in Path(relative).parts:
        if part in ("..", ".", "/"):
            raise ValueError("Traversal/absolute paths not allowed")
        path = path / part
        if path.is_symlink():
            raise ValueError("Symlinks not allowed, including parent directories")
    if not path.is_file():
        raise ValueError(f"Missing file: {relative}")
    if not path.resolve().is_relative_to(base):
        raise ValueError("Path escapes fixture root")
    return path


def _read(path: Path) -> dict[str, JsonValue]:
    def reject_constant(value: str) -> None:
        raise ValueError(f"Nonfinite JSON constant: {value}")

    def unique_object(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result

    document = json.loads(
        path.read_text(encoding="utf-8"),
        parse_constant=reject_constant,
        object_pairs_hook=unique_object,
    )
    if not isinstance(document, dict):
        raise ValueError("Expected JSON object")

    # Python's decoder parses 1e999 as infinity without parse_constant.
    def check(value: JsonValue) -> None:
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Nonfinite JSON number")
        if isinstance(value, (dict, list)):
            for item in value.values() if isinstance(value, dict) else value:
                check(item)

    check(document)
    return document


def _utc(value: object) -> None:
    if not isinstance(value, str) or datetime.fromisoformat(
        value.replace("Z", "+00:00")
    ).utcoffset() != timedelta(0):
        raise ValueError("Expected timezone-aware UTC timestamp")


def _verify_phase0(document: dict[str, JsonValue], name: str, function: str) -> None:
    # FS-07 depends on the Phase 0 producers. Reuse their full validators, never
    # the later app/schema modules. Resolve code from this release, not the
    # caller-supplied fixture directory (which is untrusted data).
    namespace = runpy.run_path(str(ROOT / f"backend/scripts/test_{name}.py"))
    namespace[function](document)


def _availability(document: dict[str, JsonValue], provider: str) -> bool:
    if set(document) != ARCHIVE_KEYS[provider]:
        raise ValueError(f"Invalid {provider} archive envelope")
    if (
        document["provider"] != provider
        or document["schema_version"] != "fixture-1"
        or document["farm_id"] != FARM_ID
        or document["location"] != LOCATION
    ):
        raise ValueError("Archive identity/location mismatch")
    name = {"power": "power_capture", "soilgrids": "soil_capture", "smap": "smap_capture"}[provider]
    function = {
        "power": "verify_power_archive",
        "soilgrids": "verify_soil_archive",
        "smap": "verify_smap_archive",
    }[provider]
    _verify_phase0(document, name, function)
    return True if provider == "power" else document["available"]


def build_fixture_manifest(root: Path) -> dict[str, JsonValue]:
    catalog = _read(_confined_file(root, CATALOG_PATH))
    if (
        set(catalog) != {"schema_version", "catalog_version", "region_id", "crops"}
        or catalog["schema_version"] != "1.0.0"
        or catalog["region_id"] != "punjab_pk_demo_v1"
    ):
        raise ValueError("Invalid catalog envelope")
    version = catalog["catalog_version"]
    if (
        not isinstance(version, str)
        or not version.strip()
        or not isinstance(catalog["crops"], list)
        or not 1 <= len(catalog["crops"]) <= 12
    ):
        raise ValueError("Invalid catalog version/records")
    _verify_phase0(catalog, "crop_catalog", "validate_catalog_document")
    files = []
    for provider in PROVIDERS:
        relative = f"backend/tests/fixtures/{provider}_archive.json"
        path = _confined_file(root, relative)
        available = _availability(_read(path), provider)
        files.append(
            asdict(
                FixtureFile(
                    provider, relative, hashlib.sha256(path.read_bytes()).hexdigest(), available
                )
            )
        )
    return {**copy.deepcopy(PINNED_MANIFEST), "catalog_version": version, "files": files}


def validate_fixture_manifest(root: Path) -> dict[str, JsonValue]:
    manifest = _read(_confined_file(root, MANIFEST_PATH))
    if set(manifest) != set(PINNED_MANIFEST) | {"catalog_version", "files"}:
        raise ValueError("Invalid manifest keys")
    if manifest["synthetic"] is not False or any(
        manifest[key] != value for key, value in PINNED_MANIFEST.items()
    ):
        raise ValueError("Manifest pin/version mismatch")
    entries = manifest["files"]
    if not isinstance(entries, list) or len(entries) != 3:
        raise ValueError("Exactly three providers required")
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"provider", "path", "sha256", "available"}:
            raise ValueError("Invalid manifest file fields")
        FixtureFile(**entry)
    if [entry["provider"] for entry in entries] != list(PROVIDERS):
        raise ValueError("Provider rows must be unique and sorted")
    expected = build_fixture_manifest(root)
    if manifest != expected:
        raise ValueError("Changed bytes, availability or catalog version mismatch")
    return manifest


def write_fixture_manifest(root: Path) -> None:
    document = build_fixture_manifest(root)
    output = _confined_file(root, MANIFEST_PATH)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            json.dump(document, handle, indent=2, allow_nan=False)
            handle.write("\n")
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    for relative in (
        MANIFEST_PATH,
        CATALOG_PATH,
        *(f"backend/tests/fixtures/{p}_archive.json" for p in PROVIDERS),
    ):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path


def test_committed_manifest() -> None:
    validate_fixture_manifest(ROOT)


def test_validation_is_read_only(workspace: Path) -> None:
    paths = list(workspace.rglob("*.json"))
    before = [(p, p.read_bytes(), p.stat().st_mtime_ns) for p in paths]
    validate_fixture_manifest(workspace)
    assert before == [(p, p.read_bytes(), p.stat().st_mtime_ns) for p in paths]


@pytest.mark.parametrize(
    "kind",
    [
        "tamper",
        "missing",
        "traversal",
        "symlink",
        "parent_symlink",
        "availability",
        "duplicate",
        "version",
        "synthetic",
        "location",
        "extra",
        "uppercase_hash",
        "numeric_bool",
        "catalog_missing",
        "catalog_version",
        "cross_farm",
    ],
)
def test_reject_invalid_workspace(workspace: Path, kind: str) -> None:
    manifest_path = workspace / MANIFEST_PATH
    manifest = json.loads(manifest_path.read_text())
    power_path = workspace / "backend/tests/fixtures/power_archive.json"
    if kind == "tamper":
        power_path.write_bytes(power_path.read_bytes() + b" ")
    elif kind == "missing":
        power_path.unlink()
    elif kind == "symlink":
        power_path.unlink()
        power_path.symlink_to("smap_archive.json")
    elif kind == "parent_symlink":
        fixtures = power_path.parent
        moved = fixtures.with_name("moved")
        fixtures.rename(moved)
        fixtures.symlink_to(moved, target_is_directory=True)
    elif kind == "traversal":
        manifest["files"][0]["path"] = "../power_archive.json"
    elif kind == "availability":
        manifest["files"][1]["available"] = not manifest["files"][1]["available"]
    elif kind == "numeric_bool":
        manifest["files"][0]["available"] = 1
    elif kind == "duplicate":
        manifest["files"][1] = copy.deepcopy(manifest["files"][0])
    elif kind == "version":
        manifest["catalog_version"] = "2.0.0"
    elif kind == "synthetic":
        manifest["synthetic"] = True
    elif kind == "location":
        manifest["location"]["latitude"] = 31.418
    elif kind == "extra":
        manifest["files"][0]["unknown"] = True
    elif kind == "uppercase_hash":
        manifest["files"][0]["sha256"] = manifest["files"][0]["sha256"].upper()
    elif kind == "catalog_missing":
        (workspace / CATALOG_PATH).unlink()
    elif kind == "catalog_version":
        catalog = json.loads((workspace / CATALOG_PATH).read_text())
        catalog["catalog_version"] = "2.0.0"
        (workspace / CATALOG_PATH).write_text(json.dumps(catalog))
    else:
        archive = json.loads(power_path.read_text())
        archive["farm_id"] = "unrelated-farm"
        power_path.write_text(json.dumps(archive))
        manifest["files"][0]["sha256"] = hashlib.sha256(power_path.read_bytes()).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        validate_fixture_manifest(workspace)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", required=True)
    args = parser.parse_args()
    write_fixture_manifest(ROOT)
    validate_fixture_manifest(ROOT)
