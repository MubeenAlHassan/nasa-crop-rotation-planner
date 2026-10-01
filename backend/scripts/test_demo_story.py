"""Audit the timed judge story against the pinned demo and wire contracts."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

STORY = Path(__file__).parents[2] / "agent_docs/JUDGE_DEMO.md"
SEGMENT = re.compile(r"^## (\d{2}):(\d{2})[–-](\d{2}):(\d{2}) — (.+)$", re.MULTILINE)
REQUIRED = (
    "faisalabad_2025", "synthetic=false", "31.4504", "73.1350",
    "2025-10-15", "rabi_2025", "2025-11-01", "2026-03-31",
    "crop_history[0]", "data_mode=auto", "backend/tests/fixtures/manifest.json",
    "backend/tests/fixtures/power_archive.json", "/api/recommend-rotation",
    "/api/v1/recommend-rotation", "features.climate.rainfall_anomaly_pct",
    "features.climate.temperature_anomaly_c", "features.slot_scenarios[0]",
    "recommendations", "components", "effective_weights", "exclusions",
    "DEMO_FIXTURE", "SMAP_UNAVAILABLE", "SOURCE_STALE",
    "features.moisture.surface_m3_m3", "failed map tile", "Unavailable",
    "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    "https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html",
    "https://nsidc.org/data/spl3smp_e/versions/6",
)
ACTION_ORDER = (
    "Use pinned Faisalabad demo", "maize", "rabi_2025",
    "Authorized demo fixture", "submit", "Climate observations",
    "ranked alternatives", "warnings",
)
PROHIBITED_CLAIMS = re.compile(
    r"\b(?:guaranteed|proven)\s+(?:yield|profit|revenue|water savings)\b|"
    r"\b(?:yield|profit|revenue|water)\s+(?:savings|increase|gain)\s+(?:of\s+)?\d+\s*%",
    re.IGNORECASE,
)


def validate_demo_script(path: Path) -> None:
    text = Path(path).read_text(encoding="utf-8")
    matches = list(SEGMENT.finditer(text))
    assert len(matches) == 5, "The story must have five timed segments"
    previous_end = 0
    for match in matches:
        start = int(match[1]) * 60 + int(match[2])
        end = int(match[3]) * 60 + int(match[4])
        assert start == previous_end and end > start, "Timing must be contiguous and increasing"
        previous_end = end
    assert previous_end == 180, "The story must finish at 03:00"
    for marker in REQUIRED:
        assert marker in text, f"Missing contract, provenance, or fallback marker: {marker}"
    cursor = 0
    for action in ACTION_ORDER:
        position = text.find(action, cursor)
        assert position >= cursor, f"Missing or out-of-order UI action: {action}"
        cursor = position + len(action)
    assert not PROHIBITED_CLAIMS.search(text), "Unsupported quantified outcome claim"


def test_valid_pinned_judge_story() -> None:
    validate_demo_script(STORY)


def test_rejects_broken_timing_and_outcome_claims(tmp_path: Path) -> None:
    text = STORY.read_text(encoding="utf-8")
    altered = tmp_path / "broken.md"
    altered.write_text(text.replace("02:25–03:00", "02:25–03:01"))
    with pytest.raises(AssertionError, match="03:00"):
        validate_demo_script(altered)
    altered.write_text(text + "\nGuaranteed yield increase of 20%.\n")
    with pytest.raises(AssertionError, match="outcome claim"):
        validate_demo_script(altered)
