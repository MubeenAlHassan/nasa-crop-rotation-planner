"""Read a checksum-approved SMAP Version 6 point archive without network access."""

from __future__ import annotations

import hashlib
import json
import time
from datetime import date, datetime
from pathlib import Path

from app.schemas.contracts import Location, Source
from app.schemas.domain import ProviderError, SmapObservation, SmapProvider, SmapSeries


class SmapArchiveProvider(SmapProvider):
    def __init__(self, archive_path: Path) -> None:
        self._archive_path = Path(archive_path)

    async def get_surface(
        self, location: Location, assessment_end: date, *, deadline: float,
    ) -> SmapSeries | None:
        if time.monotonic() >= deadline:
            raise ProviderError("smap", "Provider deadline exceeded", True)
        if not self._archive_path.is_file():
            return None
        try:
            raw_bytes = self._archive_path.read_bytes()
            archive = json.loads(raw_bytes)
            manifest = json.loads(self._archive_path.with_name("manifest.json").read_text())
            record = next(item for item in manifest["files"] if item["provider"] == "smap")
            if (record["sha256"] != hashlib.sha256(raw_bytes).hexdigest()
                or Path(record["path"]).name != self._archive_path.name
                or manifest["schema_version"] != "fixture-1"
                or archive["schema_version"] != "fixture-1"
                or archive["provider"] != "smap"
                or archive["product"] != "SPL3SMP_E"
                or archive["version"] != "6"
                or archive["grid_posting_km"] != 9
                or archive["farm_id"] != manifest["farm_id"]
                or archive["location"] != manifest["location"]
                or archive["location"] != location.model_dump(mode="json")
                or bool(record["available"]) != bool(archive["available"])):
                raise ValueError("SMAP archive does not match verified manifest")
            if not archive["available"]:
                if archive["rows"] or archive["reference_rows"] or archive["cell_id"] is not None:
                    raise ValueError("Unavailable SMAP archive contains observations")
                return None
            if not isinstance(archive["cell_id"], str) or not archive["cell_id"]:
                raise ValueError("Available SMAP archive has no cell")
            rows = tuple(SmapObservation.model_validate(row) for row in archive["rows"])
            references = tuple(SmapObservation.model_validate(row) for row in archive["reference_rows"])
            if any(row.day > assessment_end for row in rows):
                raise ValueError("SMAP archive extends beyond assessment date")
            if any(row.day.year >= assessment_end.year for row in references):
                raise ValueError("SMAP reference is not from a prior year")
            retrieved_at = datetime.fromisoformat(archive["retrieved_at"].replace("Z", "+00:00"))
            source = Source(
                provider="smap", mode="fixture", product="SPL3SMP_E V6",
                observed_start=rows[0].day if rows else None,
                observed_end=rows[-1].day if rows else None,
                retrieved_at=retrieved_at, grid_resolution_km=9.0,
                spatial_support=f"SMAP native cell {archive['cell_id']}",
                fixture_id=manifest["fixture_id"], used_for=("/features/moisture",),
            )
            return SmapSeries(
                location=location, cell_id=archive["cell_id"], rows=rows,
                reference_rows=references, source=source,
            )
        except (OSError, ValueError, KeyError, TypeError, StopIteration) as exc:
            raise ProviderError("smap", "Invalid or unapproved SMAP archive", False) from exc
