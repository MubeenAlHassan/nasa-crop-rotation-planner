"""Offline checks of research proposals; no v2 production models or rules.

These check reviewed transcription, conservative schedule arithmetic, authentic
historical selectors and the unchanged original archives. They cannot establish
local crop suitability or calibrate water, nutrient or soil-health models.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "agent_docs"


def research_block(filename: str, marker: str) -> dict:
    content = (DOCS / filename).read_text()
    match = re.search(rf"<!-- {marker} -->\s*```json\s*(.*?)\s*```", content, re.S)
    assert match, f"Missing research JSON: {marker}"
    return json.loads(match.group(1))


def proposals() -> dict[str, dict]:
    ledger = research_block("PUNJAB_CROP_EVIDENCE.md", "phase1-proposals")
    assert ledger["status"] == "research_only"
    return {crop["crop_id"]: crop for crop in ledger["crops"]}


# Independently transcribed primary-source claims/locators recorded in the ledger.
# This is a regression guard for the documents, not a new runtime crop catalog.
CLAIMS = {
    "mungbean_niab_2021": {
        "calendar_source": "S01", "species_source": "S02", "maturity_days": [70, 80],
        "planting_windows": [["0301", "0331"], ["0615", "0715"]],
        "ph_optimal": [5.5, 6.2], "ph_absolute": [4.3, 8.3],
        "temperature_optimal_c": [21, 36], "temperature_absolute_c": [8, 40],
        "annual_rainfall_optimal_mm": [650, 900], "annual_rainfall_absolute_mm": [500, 1250],
        "root_reference_m": [0.6, 1.0],
    },
    "lentil_punjab_masoor_2019": {
        "calendar_source": "S03", "species_source": "S04", "maturity_days": [125, 130],
        "planting_windows": [], "calendar_status": "tested_dates_only",
        "ph_optimal": [5.5, 7.5], "ph_absolute": [4.5, 8.2],
        "temperature_optimal_c": [15, 29], "temperature_absolute_c": [5, 32],
        "annual_rainfall_optimal_mm": [600, 1000], "annual_rainfall_absolute_mm": [250, 2500],
        "root_reference_m": [0.6, 0.8],
    },
    "sesame_ts5": {
        "calendar_source": "S06", "species_source": "S11", "maturity_days": [110, 120],
        "planting_windows": [], "calendar_status": "conflicting_sources",
        "ph_optimal": [5.5, 7.5], "ph_absolute": [4.5, 8.0],
        "temperature_optimal_c": [20, 30], "temperature_absolute_c": [10, 40],
        "annual_rainfall_optimal_mm": [500, 1000], "annual_rainfall_absolute_mm": [300, 1500],
        "root_reference_m": [1.0, 1.5],
    },
}


@pytest.mark.parametrize("crop_id", CLAIMS)
def test_proposed_traits_preserve_source_scope_and_unknowns(crop_id: str) -> None:
    crop = proposals()[crop_id]
    for key, expected in CLAIMS[crop_id].items():
        assert crop[key] == expected, (crop_id, key)
    for unknown in (
        "hard_ph_bounds", "seasonal_water_demand_mm", "nitrogen_credit_kg_ha",
        "pathogen_break_years",
    ):
        assert crop[unknown] is None
    assert crop["root_source"] == "S08"
    for trait in ("ph", "temperature", "annual_rainfall"):
        suffix = {"ph": "", "temperature": "_c", "annual_rainfall": "_mm"}[trait]
        optimal = crop[f"{trait}_optimal{suffix}"]
        absolute = crop[f"{trait}_absolute{suffix}"]
        assert absolute[0] <= optimal[0] <= optimal[1] <= absolute[1]


def test_each_proposal_source_resolves_to_reference_and_locator() -> None:
    text = (DOCS / "PUNJAB_CROP_EVIDENCE.md").read_text()
    references = dict(re.findall(r"^\| (S\d{2}) \| (.+)$", text, re.M))
    assert len(references) == 20
    for crop in proposals().values():
        for key in ("calendar_source", "species_source", "root_source"):
            reference = references[crop[key]]
            assert re.search(r"\]\(https://[^)]+\)", reference)
            assert any(word in reference for word in ("Table", "Ecology", "General", "Methods", "row"))


def test_conflicted_sesame_and_tested_lentil_dates_are_not_invented_windows() -> None:
    crops = proposals()
    assert crops["sesame_ts5"]["conflicting_windows"] == [
        {"start_mmdd": "0415", "end_mmdd": "0615", "source_id": "S06"},
        {"start_mmdd": "0615", "end_mmdd": "0715", "source_id": "S07"},
    ]
    assert "1030" in crops["lentil_punjab_masoor_2019"]["tested_sowing_mmdd"]
    assert crops["lentil_punjab_masoor_2019"]["planting_windows"] == []
    assert crops["sesame_ts5"]["planting_windows"] == []


def demo() -> dict:
    return research_block("NEW_DEMO_DESIGN.md", "phase1-demo")


def test_one_new_crop_creates_two_sequences_for_the_fixed_demo_dates() -> None:
    document = demo()
    old = json.loads((ROOT / "backend/data/punjab_crops.json").read_text())
    windows = {crop["crop_id"]: [
        [window["start_mmdd"], window["end_mmdd"]] for window in crop["planting_windows"]
    ] for crop in old["crops"]}

    def candidates(day: str, catalog: dict) -> set[str]:
        mmdd = date.fromisoformat(day).strftime("%m%d")
        return {crop for crop, intervals in catalog.items()
                if any(start <= mmdd <= end for start, end in intervals)}

    dates = [season["sown_on"] for season in document["seasons"]]
    assert [candidates(day, windows) for day in dates] == [{"wheat"}, {"maize"}]
    windows["mungbean_niab_2021"] = proposals()["mungbean_niab_2021"]["planting_windows"]
    assert [candidates(day, windows) for day in dates] == [
        {"wheat"}, {"maize", "mungbean_niab_2021"},
    ]
    sequences = {tuple(item["crop_ids"]) for item in document["sequences"]}
    assert sequences == {("wheat", "maize"), ("wheat", "mungbean_niab_2021")}
    assert document["status"] == "research_only"
    assert document["seasonal_water_claim_mm"] is None
    assert document["hard_ph_assumption"] is None


@pytest.mark.parametrize("sequence_id", ["wheat_maize", "wheat_mungbean"])
def test_demo_latest_maturity_and_explicit_clearance_fit(sequence_id: str) -> None:
    document = demo()
    sequence = next(item for item in document["sequences"] if item["sequence_id"] == sequence_id)
    assert document["clearance_basis"] == "farmer_scenario_assumption_pending_review"
    assert len(sequence["crop_ids"]) == len(document["seasons"]) == 2
    for index, season in enumerate(document["seasons"]):
        sown = date.fromisoformat(season["sown_on"])
        latest = sown + timedelta(days=sequence["maturity_days"][index][1])
        assert latest.isoformat() == sequence["maturity_latest"][index]
        clearance = latest + timedelta(days=document["clearance_allowance_days"])
        assert clearance <= date.fromisoformat(season["harvest_deadline"])
        if index + 1 < len(document["seasons"]):
            assert clearance < date.fromisoformat(document["seasons"][index + 1]["sown_on"])


def test_summer_maize_cannot_be_followed_by_november_wheat() -> None:
    sown = date(2026, 7, 15)
    next_wheat = date(2026, 11, 1)
    assert sown + timedelta(days=125) > next_wheat
    assert sown + timedelta(days=180) == date(2027, 1, 11)


def test_v2_example_matches_research_demo_and_preserves_unknown_inputs() -> None:
    request = research_block("API_V2_DESIGN.md", "phase1-v2-request")
    document = demo()
    assert request["schema_version"] == "2.0.0"
    assert request["location"] == document["location"]
    assert request["assessment_end"] == document["assessment_end"]
    assert request["data_selection"] == {"mode": "demo", "snapshot_id": document["demo_id"]}
    plan = request["planning"]
    assert plan["season_count"] == len(plan["seasons"]) == 2
    assert plan["calendar_policy"] == "conservative_latest_clearance"
    assert plan["clearance_allowance_days"] == {"min": 7, "max": 7}
    for season, expected in zip(plan["seasons"], document["seasons"], strict=True):
        assert season["sowing_start"] == season["sowing_end"] == expected["sown_on"]
        assert season["harvest_deadline"] == expected["harvest_deadline"]
    assert request["soil_inputs"] == []
    assert request["field_context"]["drainage"] == "unknown"
    assert request["field_context"]["salinity_ec_ds_m"] is None
    assert request["irrigation"]["season_allocations"] == []
    assert request["selected_rotation_id"] is None
    weights = request["priorities"].values()
    assert all(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 100
               for value in weights)
    assert sum(weights) > 0
    assert date.fromisoformat(plan["seasons"][-1]["harvest_deadline"]) <= (
        date.fromisoformat(request["assessment_end"]) + timedelta(days=730)
    )


def historical_envelopes() -> list[tuple[int, float, float]]:
    archive = json.loads((ROOT / "backend/tests/fixtures/power_archive.json").read_text())
    rain, temperature = {}, {}
    for request in archive["requests"]:
        assert dict(request["params"])["time-standard"] == "UTC"
        fields = request["payload"]["properties"]["parameter"]
        rain.update(fields["PRECTOTCORR"])
        temperature.update(fields["T2M"])
    rows = []
    for anchor in range(1991, 2019):
        aggregates = []
        for start, end in ((date(anchor, 11, 1), date(anchor + 1, 4, 15)),
                           (date(anchor + 1, 7, 15), date(anchor + 2, 1, 31))):
            calendar = []
            day = start
            while day <= end:
                if (day.month, day.day) != (2, 29):
                    calendar.append(day.strftime("%Y%m%d"))
                day += timedelta(days=1)
            rainfall = [rain.get(day, -999) for day in calendar]
            temperatures = [temperature.get(day, -999) for day in calendar]
            # These source windows are fully present, stronger than the proposed90% minimum.
            assert all(math.isfinite(value) and value >= 0 for value in rainfall)
            assert all(math.isfinite(value) and value != -999 for value in temperatures)
            aggregates.append((sum(rainfall), sum(temperatures) / len(temperatures)))
        rows.append((anchor, *aggregates[1]))
    return rows


def test_historical_selectors_use_authentic_common_anchor_years() -> None:
    rows = historical_envelopes()
    expected = demo()["historical_selectors"]
    assert [rows[0][0], rows[-1][0]] == expected["eligible_anchor_years"]
    assert len(rows) == expected["eligible_anchor_count"] == 28
    dry = min(rows, key=lambda row: (row[1], row[0]))
    hot = min(rows, key=lambda row: (-row[2], row[0]))
    assert dry[0] == expected["lowest_rainfall_anchor"] == 1996
    assert hot[0] == expected["highest_mean_temperature_anchor"] == 1998
    assert dry[1] == pytest.approx(expected["lowest_rainfall_mm"])
    assert hot[2] == pytest.approx(expected["highest_mean_temperature_c"])
    assert sum(row[1] for row in rows) / len(rows) == pytest.approx(199.07)


FIXTURE_HASHES = {
    "manifest.json": "90b3468adcb5eec6379f3b780c86ac7c315bdf56e969027b86b1459115873df4",
    "power_archive.json": "4ac69b0b0d70696c89ef133876885bf186840d4c7c810d25b86904a12409b5de",
    "smap_archive.json": "bb7710d7a85b941c906cae958f5a6a3da6733c0ff539ca1a76637d867edc9bf2",
    "soilgrids_archive.json": "ccadcb07bf42fa19bf92ec7e071d7bce82e513f28e6757904c4182acc1ab9b13",
}


@pytest.mark.parametrize("filename,sha256", FIXTURE_HASHES.items())
def test_original_fixture_bytes_are_unchanged(filename: str, sha256: str) -> None:
    path = ROOT / "backend/tests/fixtures" / filename
    assert hashlib.sha256(path.read_bytes()).hexdigest() == sha256
