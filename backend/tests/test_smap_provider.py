import asyncio
import hashlib
import json
import time
from datetime import date
from pathlib import Path

import pytest
from app.providers.smap import SmapArchiveProvider
from app.schemas.contracts import Location
from app.schemas.domain import ProviderError

LOCATION = Location(latitude=31.4504, longitude=73.135)
FIXTURE = Path(__file__).parent / "fixtures" / "smap_archive.json"


def get(path=FIXTURE, location=LOCATION):
    return asyncio.run(SmapArchiveProvider(path).get_surface(location, date(2025, 10, 15), deadline=time.monotonic() + 5))


def approved(tmp_path, *, available=True, version="6", cell="cell-1"):
    archive = json.loads(FIXTURE.read_text())
    archive.update(available=available, version=version, cell_id=cell if available else None)
    archive["rows"] = ([{"day": "2025-10-10", "surface_m3_m3": 0.2, "retrieval_quality_flag": 8, "pass_id": "AM"}] if available else [])
    archive["reference_rows"] = ([{"day": "2020-10-10", "surface_m3_m3": 0.3, "retrieval_quality_flag": 0, "pass_id": "AM"}] if available else [])
    path = tmp_path / "smap_archive.json"
    path.write_text(json.dumps(archive))
    manifest = {"schema_version": "fixture-1", "fixture_id": "faisalabad_2025", "farm_id": archive["farm_id"], "location": archive["location"], "files": [{"provider": "smap", "path": "backend/tests/fixtures/smap_archive.json", "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "available": available}]}
    (tmp_path / "manifest.json").write_text(json.dumps(manifest))
    return path


def test_real_unavailable_archive_and_missing(tmp_path):
    assert get() is None
    assert get(tmp_path / "missing.json") is None


def test_approved_archive_preserves_flags_and_cell(tmp_path):
    series = get(approved(tmp_path))
    assert series.cell_id == "cell-1"
    assert series.rows[0].retrieval_quality_flag == 8
    assert series.reference_rows[0].surface_m3_m3 == 0.3
    assert series.source.fixture_id == "faisalabad_2025"


def test_rejects_tamper_version_and_point(tmp_path):
    path = approved(tmp_path)
    with pytest.raises(ProviderError):
        get(path, Location(latitude=31.45, longitude=73.135))
    path.write_text(path.read_text() + " ")
    with pytest.raises(ProviderError):
        get(path)
    with pytest.raises(ProviderError):
        get(approved(tmp_path, version="5"))
