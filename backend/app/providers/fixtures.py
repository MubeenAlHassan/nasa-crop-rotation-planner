"""Hash-pinned, network-free providers for the single authorized demo farm."""

from __future__ import annotations

import hashlib
import json
import math
import re
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.schemas.contracts import Location, Slot, Source
from app.schemas.domain import (
    SOIL_DIVISORS, FixtureMismatch, PowerDaily, PowerSeries, ProviderBundle,
    ProviderError, RequiredDataUnavailable, SmapObservation, SmapSeries,
    SoilLayer, SoilProfile,
)

_ARCHIVES = {
    "power": "backend/tests/fixtures/power_archive.json",
    "soilgrids": "backend/tests/fixtures/soilgrids_archive.json",
    "smap": "backend/tests/fixtures/smap_archive.json",
}
_HASH = re.compile(r"^[0-9a-f]{64}$")


class _FrozenModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)


class FixtureFile(_FrozenModel):
    provider: Literal["power", "soilgrids", "smap"]
    path: str
    sha256: str
    available: bool

    @model_validator(mode="after")
    def check_record(self) -> FixtureFile:
        if self.path != _ARCHIVES[self.provider] or not _HASH.fullmatch(self.sha256):
            raise ValueError("Unapproved fixture path or digest")
        return self


class FixtureManifest(_FrozenModel):
    schema_version: Literal["fixture-1"]
    fixture_id: str = Field(min_length=1)
    farm_id: str = Field(min_length=1)
    location: Location
    assessment_end: date
    slots: tuple[Slot, ...] = Field(min_length=1, max_length=4)
    catalog_version: str = Field(min_length=1)
    transform_version: Literal["features-v1"]
    synthetic: bool
    files: tuple[FixtureFile, ...]

    @model_validator(mode="after")
    def check_manifest(self) -> FixtureManifest:
        if {record.provider for record in self.files} != set(_ARCHIVES) or len(self.files) != 3:
            raise ValueError("Manifest requires exactly one archive per provider")
        if self.synthetic or not next(record for record in self.files if record.provider == "power").available:
            raise ValueError("Only genuine fixtures with required POWER data are supported")
        return self


def _json_bytes(raw: bytes) -> dict:
    def reject_constant(value: str) -> None:
        raise ValueError(f"Non-finite JSON constant: {value}")

    value = json.loads(raw, parse_constant=reject_constant)
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


def _read_archives(root: Path) -> tuple[FixtureManifest, dict[str, dict]]:
    try:
        manifest = FixtureManifest.model_validate(
            _json_bytes((root / "backend/tests/fixtures/manifest.json").read_bytes())
        )
        archives: dict[str, dict] = {}
        for record in manifest.files:
            path = root / record.path
            try:
                raw = path.read_bytes()
            except OSError as exc:
                if record.provider == "power":
                    raise RequiredDataUnavailable("Pinned POWER archive is missing.", False) from exc
                raise FixtureMismatch(f"{record.provider} fixture archive is missing") from exc
            if hashlib.sha256(raw).hexdigest() != record.sha256:
                raise FixtureMismatch(f"{record.provider} fixture digest mismatch")
            archive = _json_bytes(raw)
            if (archive.get("schema_version") != "fixture-1"
                or archive.get("provider") != record.provider
                or archive.get("farm_id") != manifest.farm_id
                or archive.get("location") != manifest.location.model_dump(mode="json")
                or (record.provider != "power" and archive.get("available") is not record.available)):
                raise FixtureMismatch(f"{record.provider} fixture metadata mismatch")
            archives[record.provider] = archive
        return manifest, archives
    except FixtureMismatch:
        raise
    except RequiredDataUnavailable:
        raise
    except (OSError, ValueError, TypeError, ValidationError) as exc:
        raise FixtureMismatch("Invalid or missing pinned fixture manifest/archive") from exc


def load_fixture_manifest(root: Path) -> FixtureManifest:
    """Validate every approved archive before exposing any manifest metadata."""
    return _read_archives(Path(root))[0]


def _retrieved(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.utcoffset() != timedelta(0):
        raise ValueError("Retrieval time must be UTC")
    return parsed


class _FixturePower:
    def __init__(self, manifest: FixtureManifest, archive: dict) -> None:
        self._manifest = manifest
        self._days: dict[date, PowerDaily] = {}
        self._retrieved: dict[date, datetime] = {}
        if not isinstance(archive.get("requests"), list) or len(archive["requests"]) != 31:
            raise RequiredDataUnavailable("Pinned POWER observation and baseline are incomplete.", False)
        try:
            for item in archive["requests"]:
                start, end = date.fromisoformat(item["start_date"]), date.fromisoformat(item["end_date"])
                body = item["payload"]
                header, parameters = body["header"], body["parameters"]
                if (item["status_code"] != 200 or end < start
                    or header["time_standard"] != "UTC"
                    or header["start"] != start.strftime("%Y%m%d")
                    or header["end"] != end.strftime("%Y%m%d")
                    or parameters["PRECTOTCORR"]["units"] != "mm/day"
                    or parameters["T2M"]["units"] != "C"):
                    raise ValueError("POWER request metadata mismatch")
                params = dict(item["params"])
                if (params.get("latitude") != str(manifest.location.latitude)
                    or params.get("longitude") != str(manifest.location.longitude)
                    or params.get("start") != start.strftime("%Y%m%d")
                    or params.get("end") != end.strftime("%Y%m%d")):
                    raise ValueError("POWER request point or period mismatch")
                fill = header["fill_value"]
                retrieved = _retrieved(item["retrieved_at"])
                rainfall = body["properties"]["parameter"]["PRECTOTCORR"]
                temperature = body["properties"]["parameter"]["T2M"]
                for offset in range((end - start).days + 1):
                    day = start + timedelta(days=offset)
                    if day in self._days:
                        raise ValueError("Overlapping POWER archive days")
                    key = day.strftime("%Y%m%d")
                    values = []
                    for raw in (rainfall[key], temperature[key]):
                        if isinstance(raw, bool) or not isinstance(raw, (float, int)) or not math.isfinite(raw):
                            raise ValueError("Invalid POWER value")
                        values.append(None if raw == fill else float(raw))
                    self._days[day] = PowerDaily(day=day, rainfall_mm=values[0], temperature_c=values[1])
                    self._retrieved[day] = retrieved
            observed_start = manifest.assessment_end - timedelta(days=89)
            expected = {observed_start + timedelta(days=offset) for offset in range(90)}
            expected.update(date(1991, 1, 1) + timedelta(days=offset)
                            for offset in range((date(2020, 12, 31) - date(1991, 1, 1)).days + 1))
            if set(self._days) != expected:
                raise ValueError("POWER observation or baseline coverage mismatch")
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise RequiredDataUnavailable("Pinned POWER observation and baseline are invalid.", False) from exc

    async def get_daily(self, location: Location, start: date, end: date, *, deadline: float) -> PowerSeries:
        if location != self._manifest.location or end < start:
            raise FixtureMismatch("Fixture POWER point or period mismatch")
        days = [start + timedelta(days=offset) for offset in range((end - start).days + 1)]
        if not days or any(day not in self._days for day in days):
            raise FixtureMismatch("Fixture POWER period is outside pinned coverage")
        if time.monotonic() >= deadline:
            raise ProviderError("power", "Provider deadline exceeded", True)
        source = Source(provider="power", mode="fixture", product="POWER daily AG UTC",
                        observed_start=start, observed_end=end,
                        retrieved_at=max(self._retrieved[day] for day in days),
                        grid_resolution_km=None, spatial_support="NASA POWER native point sample",
                        fixture_id=self._manifest.fixture_id,
                        used_for=("/features/climate", "/features/slot_scenarios"))
        return PowerSeries(location=location, rows=tuple(self._days[day] for day in days), source=source)


class _FixtureSoil:
    def __init__(self, manifest: FixtureManifest, archive: dict) -> None:
        self._manifest, self._archive = manifest, archive

    async def get_topsoil(self, location: Location, *, deadline: float) -> SoilProfile:
        if location != self._manifest.location:
            raise FixtureMismatch("Fixture SoilGrids point mismatch")
        if time.monotonic() >= deadline:
            raise ProviderError("soilgrids", "Provider deadline exceeded", True)
        if not self._archive["available"]:
            raise ProviderError("soilgrids", "Pinned SoilGrids source is unavailable", False)
        try:
            layers = tuple(SoilLayer.model_validate(layer) for layer in self._archive["layers"])
            if len(layers) != 18 or {layer.property for layer in layers} != set(SOIL_DIVISORS):
                raise ValueError("Incomplete SoilGrids layers")
            source = Source(provider="soilgrids", mode="fixture", product="SoilGrids-2.0",
                            observed_start=None, observed_end=None,
                            retrieved_at=_retrieved(self._archive["retrieved_at"]),
                            grid_resolution_km=0.25, spatial_support="Modeled 250 m point grid",
                            fixture_id=self._manifest.fixture_id, used_for=("/features/soil",))
            return SoilProfile(location=location, layers=layers, source=source)
        except (KeyError, TypeError, ValueError, ValidationError) as exc:
            raise ProviderError("soilgrids", "Invalid pinned SoilGrids archive", False) from exc


class _FixtureSmap:
    def __init__(self, manifest: FixtureManifest, archive: dict) -> None:
        self._manifest, self._archive = manifest, archive

    async def get_surface(self, location: Location, assessment_end: date, *, deadline: float) -> SmapSeries | None:
        if location != self._manifest.location or assessment_end != self._manifest.assessment_end:
            raise FixtureMismatch("Fixture SMAP point or assessment date mismatch")
        if time.monotonic() >= deadline:
            raise ProviderError("smap", "Provider deadline exceeded", True)
        if not self._archive["available"]:
            return None
        try:
            rows = tuple(SmapObservation.model_validate(item) for item in self._archive["rows"])
            references = tuple(SmapObservation.model_validate(item) for item in self._archive["reference_rows"])
            source = Source(provider="smap", mode="fixture", product="SPL3SMP_E V6",
                            observed_start=rows[0].day if rows else None,
                            observed_end=rows[-1].day if rows else None,
                            retrieved_at=_retrieved(self._archive["retrieved_at"]),
                            grid_resolution_km=9.0, spatial_support=f"SMAP native cell {self._archive['cell_id']}",
                            fixture_id=self._manifest.fixture_id, used_for=("/features/moisture",))
            return SmapSeries(location=location, cell_id=self._archive["cell_id"], rows=rows,
                              reference_rows=references, source=source)
        except (KeyError, TypeError, ValueError, ValidationError, IndexError) as exc:
            raise ProviderError("smap", "Invalid pinned SMAP archive", False) from exc


def create_fixture_provider_bundle(root: Path, location: Location, *, enabled: bool) -> ProviderBundle:
    if enabled is not True:
        raise FixtureMismatch("Demo fixture mode is disabled")
    manifest, archives = _read_archives(Path(root))
    if location != manifest.location:
        raise FixtureMismatch("Fixture point does not match the pinned farm")
    return ProviderBundle(power=_FixturePower(manifest, archives["power"]),
                          soil=_FixtureSoil(manifest, archives["soilgrids"]),
                          smap=_FixtureSmap(manifest, archives["smap"]))
