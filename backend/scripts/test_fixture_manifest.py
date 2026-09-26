import json
import hashlib
import os
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Literal, Any, Dict, List
import pytest
import shutil
import tempfile

JsonValue = Any

@dataclass(frozen=True)
class FixtureFile:
    provider: Literal["power", "soilgrids", "smap"]
    path: str
    sha256: str
    available: bool

def _hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest().lower()

def build_fixture_manifest(root: Path) -> dict[str, JsonValue]:
    power_path = Path("backend/tests/fixtures/power_archive.json")
    smap_path = Path("backend/tests/fixtures/smap_archive.json")
    soilgrids_path = Path("backend/tests/fixtures/soilgrids_archive.json")
    
    # Read archives for availability
    power_avail = True # power must be available
    with open(root / smap_path, "r", encoding="utf-8") as f:
        smap_avail = json.load(f).get("available", True)
    with open(root / soilgrids_path, "r", encoding="utf-8") as f:
        sg_data = json.load(f)
        sg_avail = sg_data.get("availability") != "unavailable" if "availability" in sg_data else True

    files = [
        FixtureFile(
            provider="power",
            path=str(power_path),
            sha256=_hash_file(root / power_path),
            available=power_avail
        ),
        FixtureFile(
            provider="smap",
            path=str(smap_path),
            sha256=_hash_file(root / smap_path),
            available=smap_avail
        ),
        FixtureFile(
            provider="soilgrids",
            path=str(soilgrids_path),
            sha256=_hash_file(root / soilgrids_path),
            available=sg_avail
        )
    ]
    
    # sorted lexicographically: power, smap, soilgrids
    files.sort(key=lambda x: x.provider)

    manifest = {
        "schema_version": "fixture-1",
        "fixture_id": "faisalabad_2025",
        "synthetic": False,
        "transform_version": "features-v1",
        "catalog_version": "1.0.0",
        "farm": "faisalabad",
        "coordinates": [31.418, 73.079],
        "assessment_date": "2025-10-15",
        "slot": "rabi_2025",
        "files": [asdict(f) for f in files]
    }
    return manifest

def validate_fixture_manifest(root: Path) -> dict[str, JsonValue]:
    manifest_path = root / "backend/tests/fixtures/manifest.json"
    if not manifest_path.exists():
        raise AssertionError("Manifest file is missing")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # 1. Pinned values
    assert manifest.get("schema_version") == "fixture-1"
    assert manifest.get("fixture_id") == "faisalabad_2025"
    assert manifest.get("synthetic") is False
    assert manifest.get("transform_version") == "features-v1"
    assert manifest.get("catalog_version") == "1.0.0"
    assert manifest.get("farm") == "faisalabad"
    assert manifest.get("coordinates") == [31.418, 73.079]
    assert manifest.get("assessment_date") == "2025-10-15"
    assert manifest.get("slot") == "rabi_2025"

    files = manifest.get("files", [])
    assert len(files) == 3
    
    seen_providers = set()
    
    expected_providers = ["power", "smap", "soilgrids"]
    actual_providers = [f.get("provider") for f in files]
    assert actual_providers == expected_providers, "Duplicate entries, missing entries, or not sorted"
    
    for f_data in files:
        provider = f_data["provider"]
        assert provider not in seen_providers, "Duplicate providers"
        seen_providers.add(provider)
        
        path_str = f_data["path"]
        assert not os.path.isabs(path_str), "Absolute paths not allowed"
        assert ".." not in path_str, "Traversal not allowed"
        
        expected_path = f"backend/tests/fixtures/{provider}_archive.json"
        assert path_str == expected_path, "Wrong provider/path association"
        
        full_path = root / path_str
        assert full_path.exists(), "Missing file"
        assert not full_path.is_symlink(), "Escaping symlinks not allowed"
        
        # Checkhash
        expected_sha256 = f_data["sha256"]
        assert expected_sha256 != "placeholder", "Placeholder digests not allowed"
        
        actual_sha256 = _hash_file(full_path)
        assert actual_sha256 == expected_sha256, "Changed file bytes"
        
        # Check availability
        available = f_data["available"]
        if provider == "power":
            assert available is True, "POWER must be available"
        elif provider == "smap":
            with open(full_path, "r", encoding="utf-8") as af:
                smap_data = json.load(af)
            assert available == smap_data.get("available", True), "Availability mismatch"
        elif provider == "soilgrids":
            with open(full_path, "r", encoding="utf-8") as af:
                sg_data = json.load(af)
            expected_avail = sg_data.get("availability") != "unavailable" if "availability" in sg_data else True
            assert available == expected_avail, "Availability mismatch"

    # Write atomically
    temp_fd, temp_path = tempfile.mkstemp(dir=str(manifest_path.parent))
    try:
        with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        os.replace(temp_path, manifest_path)
    except Exception:
        os.remove(temp_path)
        raise
        
    return manifest

# Pytest tests

@pytest.fixture
def workspace(tmp_path):
    # Setup dummy workspace
    fixtures_dir = tmp_path / "backend/tests/fixtures"
    fixtures_dir.mkdir(parents=True)
    
    # Create fake archives
    power_data = {"schema_version": "1.0", "provider": "nasa_power"}
    smap_data = {"available": True}
    sg_data = {"availability": "unavailable"}
    
    with open(fixtures_dir / "power_archive.json", "w") as f:
        json.dump(power_data, f)
    with open(fixtures_dir / "smap_archive.json", "w") as f:
        json.dump(smap_data, f)
    with open(fixtures_dir / "soilgrids_archive.json", "w") as f:
        json.dump(sg_data, f)
        
    # Build manifest
    manifest = build_fixture_manifest(tmp_path)
    with open(fixtures_dir / "manifest.json", "w") as f:
        json.dump(manifest, f)
        
    return tmp_path

def test_validate_committed_manifest():
    root = Path(__file__).parent.parent.parent
    validate_fixture_manifest(root)

def test_validate_success(workspace):
    validate_fixture_manifest(workspace)

def test_reject_one_byte_tampering(workspace):
    power_path = workspace / "backend/tests/fixtures/power_archive.json"
    with open(power_path, "a") as f:
        f.write(" ")
    with pytest.raises(AssertionError, match="Changed file bytes"):
        validate_fixture_manifest(workspace)

def test_reject_missing_files(workspace):
    power_path = workspace / "backend/tests/fixtures/power_archive.json"
    power_path.unlink()
    with pytest.raises(AssertionError, match="Missing file"):
        validate_fixture_manifest(workspace)

def test_reject_traversal(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["files"][0]["path"] = "../fixtures/power_archive.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError, match="Traversal not allowed"):
        validate_fixture_manifest(workspace)

def test_reject_symlink(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    power_path = workspace / "backend/tests/fixtures/power_archive.json"
    
    # Create a symlink to replace the file
    symlink_path = workspace / "backend/tests/fixtures/power_archive_sym.json"
    os.symlink(power_path.name, symlink_path)
    
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
        
    # Trick it to expect the symlink (though path assoc check will catch it first if we just change the path)
    # But wait, the validator requires exact path `backend/tests/fixtures/power_archive.json`.
    # So we must replace the actual expected path with a symlink.
    power_path.unlink()
    os.symlink("smap_archive.json", power_path)
    
    with pytest.raises(AssertionError, match="Escaping symlinks not allowed"):
        validate_fixture_manifest(workspace)

def test_reject_availability_mismatch(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["files"][1]["available"] = False
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError, match="Availability mismatch"):
        validate_fixture_manifest(workspace)

def test_reject_duplicate_entries(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["files"][1] = manifest["files"][0]
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError):
        validate_fixture_manifest(workspace)

def test_reject_version_mismatch(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["catalog_version"] = "2.0.0"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError):
        validate_fixture_manifest(workspace)

def test_reject_synthetic_mismatch(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["synthetic"] = True
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError):
        validate_fixture_manifest(workspace)

def test_reject_altered_coordinates(workspace):
    manifest_path = workspace / "backend/tests/fixtures/manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    manifest["coordinates"] = [0.0, 0.0]
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    with pytest.raises(AssertionError):
        validate_fixture_manifest(workspace)
