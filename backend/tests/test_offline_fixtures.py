"""The demo provider must use only the exact, hash-approved farm archives."""

import asyncio
import json
import socket
import shutil
import time
from datetime import date
from pathlib import Path

import pytest

from app.providers.fixtures import create_fixture_provider_bundle, load_fixture_manifest
from app.schemas.contracts import Location
from app.schemas.domain import FixtureMismatch, ProviderError, RequiredDataUnavailable

ROOT = Path(__file__).parents[2]
POINT = Location(latitude=31.4504, longitude=73.135)


def copied_fixture_root(tmp_path: Path) -> Path:
    target = tmp_path / "backend/tests/fixtures"
    target.mkdir(parents=True)
    for path in (ROOT / "backend/tests/fixtures").glob("*.json"):
        shutil.copyfile(path, target / path.name)
    return tmp_path


def test_manifest_and_offline_power_are_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    manifest = load_fixture_manifest(ROOT)
    assert manifest.fixture_id == "faisalabad_2025"
    bundle = create_fixture_provider_bundle(ROOT, POINT, enabled=True)

    native_socket = socket.socket

    def forbidden_socket(family: int = socket.AF_INET, *args: object, **kwargs: object) -> socket.socket:
        if family in (socket.AF_INET, socket.AF_INET6):
            raise AssertionError("Fixture provider attempted network access")
        return native_socket(family, *args, **kwargs)

    monkeypatch.setattr("socket.socket", forbidden_socket)

    async def read_twice() -> None:
        deadline = time.monotonic() + 5
        first = await bundle.power.get_daily(POINT, date(2025, 7, 18), date(2025, 10, 15), deadline=deadline)
        second = await bundle.power.get_daily(POINT, date(2025, 7, 18), date(2025, 10, 15), deadline=deadline)
        baseline = await bundle.power.get_daily(POINT, date(1991, 1, 1), date(2020, 12, 31), deadline=deadline)
        assert first == second
        assert len(first.rows) == 90
        assert len(baseline.rows) == 10958
        assert first.source.mode == baseline.source.mode == "fixture"
        assert first.source.fixture_id == "faisalabad_2025"
        with pytest.raises(ProviderError) as soil_error:
            await bundle.soil.get_topsoil(POINT, deadline=deadline)
        assert soil_error.value.provider == "soilgrids"
        assert soil_error.value.retryable is False
        assert await bundle.smap.get_surface(POINT, date(2025, 10, 15), deadline=deadline) is None

    asyncio.run(read_twice())


@pytest.mark.parametrize("provider", ["power", "soilgrids", "smap"])
def test_every_archive_hash_is_checked(tmp_path: Path, provider: str) -> None:
    root = copied_fixture_root(tmp_path)
    archive = root / f"backend/tests/fixtures/{'soilgrids' if provider == 'soilgrids' else provider}_archive.json"
    archive.write_bytes(archive.read_bytes() + b" ")
    with pytest.raises(FixtureMismatch, match=f"{provider} fixture digest mismatch"):
        load_fixture_manifest(root)


def test_disabled_wrong_point_and_wrong_period() -> None:
    nearby = Location(latitude=31.4505, longitude=73.135)
    with pytest.raises(FixtureMismatch, match="disabled"):
        create_fixture_provider_bundle(ROOT, POINT, enabled=False)
    with pytest.raises(FixtureMismatch, match="pinned farm"):
        create_fixture_provider_bundle(ROOT, nearby, enabled=True)
    bundle = create_fixture_provider_bundle(ROOT, POINT, enabled=True)

    async def check() -> None:
        deadline = time.monotonic() + 5
        with pytest.raises(FixtureMismatch, match="point"):
            await bundle.power.get_daily(nearby, date(2025, 7, 18), date(2025, 10, 15), deadline=deadline)
        with pytest.raises(FixtureMismatch, match="coverage"):
            await bundle.power.get_daily(POINT, date(2025, 7, 17), date(2025, 10, 15), deadline=deadline)
        with pytest.raises(FixtureMismatch, match="assessment date"):
            await bundle.smap.get_surface(POINT, date(2025, 10, 14), deadline=deadline)

    asyncio.run(check())


def test_missing_required_power_and_synthetic_manifest(tmp_path: Path) -> None:
    root = copied_fixture_root(tmp_path)
    manifest_path = root / "backend/tests/fixtures/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["files"][0]["available"] = False
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(FixtureMismatch, match="manifest"):
        load_fixture_manifest(root)
    manifest["files"][0]["available"] = True
    manifest["synthetic"] = True
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(FixtureMismatch, match="manifest"):
        load_fixture_manifest(root)
    manifest["synthetic"] = False
    manifest_path.write_text(json.dumps(manifest))
    power = root / "backend/tests/fixtures/power_archive.json"
    power.unlink()
    with pytest.raises(FixtureMismatch, match="manifest"):
        create_fixture_provider_bundle(root, POINT, enabled=True)


def test_missing_power_coverage_is_required_data_error(tmp_path: Path) -> None:
    root = copied_fixture_root(tmp_path)
    power = root / "backend/tests/fixtures/power_archive.json"
    archive = json.loads(power.read_text())
    archive["requests"].pop()
    raw = json.dumps(archive).encode()
    power.write_bytes(raw)
    manifest_path = root / "backend/tests/fixtures/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    import hashlib
    next(item for item in manifest["files"] if item["provider"] == "power")["sha256"] = hashlib.sha256(raw).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(RequiredDataUnavailable, match="incomplete"):
        create_fixture_provider_bundle(root, POINT, enabled=True)
