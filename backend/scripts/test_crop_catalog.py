"""Strict, versioned regional catalog with a reviewed trait evidence ledger.

Species ranges support screening, not cultivar recommendations. The frozen wire
format names the water-supply screen rainfall_*: its values below are seasonal
crop water demand proxies (rain + stored water + irrigation), NOT annual rainfall
or a prediction of effective rainfall. No calibrated local rainfall range is
claimed. Root/N/tolerance classes and crop-count breaks are explicit heuristic
mappings; their source observations and limitations are recorded in the ledger.
"""

from __future__ import annotations

import copy
import json
import math
import re
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import pytest
from pydantic import JsonValue

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data/punjab_crops.json"
REQUIRED_CROP_FIELDS = {
    "crop_id",
    "crop_name",
    "family",
    "region_ids",
    "planting_windows",
    "maturity_min_days",
    "maturity_max_days",
    "nitrogen_demand",
    "legume",
    "root_class",
    "rainfall_min_mm",
    "rainfall_max_mm",
    "temperature_min_c",
    "temperature_max_c",
    "ph_min",
    "ph_max",
    "drought_tolerant",
    "waterlogging_tolerant",
    "irrigation_required",
    "family_break_crops",
    "references",
}
WATER = "https://www.fao.org/4/s2022e/s2022e02.htm"
ROOTS = "https://www.fao.org/4/x0490e/x0490e0e.htm"
ROTATION = "https://www.fao.org/4/v9926e/v9926e06.htm"
WHEAT_CALENDAR = "https://api.gov.pk/SiteImage/Policy/WheatPolicyAnalysis%20For2017-18Crop.pdf"
MAIZE_CALENDAR = "https://pdf.usaid.gov/pdf_docs/PNABW084.pdf"
MAIZE_LOCAL = "https://www.mdpi.com/2071-1050/13/5/2757"
CHICKPEA_CALENDAR = "https://bcsrj.com/ojs/index.php/bcsrj/article/download/986/1230/3302"
CHICKPEA_MANUAL = "https://oar.icrisat.org/10276/1/ChickpeaManual_full.pdf"
CHICKPEA_WATER = "https://oar.icrisat.org/535/1/RA_00152.pdf"
MAIZE_TOLERANCE = "https://www.fao.org/4/x7660e/x7660e09.htm"
ECO = {
    "wheat": "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2114",
    "chickpea": "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2479",
    "maize": "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=238663",
}


# Each entry binds an explicit reviewed value to an actual source and locator.
# This is evidence for catalog version 1.0.1, not a set of runtime defaults.
EVIDENCE_MAP: dict[str, dict[str, dict[str, JsonValue]]] = {}


def _evidence(
    crop_id: str, traits: Mapping[str, JsonValue], source: str, locator: str, interpretation: str
) -> None:
    for field, value in traits.items():
        if field in EVIDENCE_MAP.setdefault(crop_id, {}):
            raise ValueError("Duplicate trait evidence")
        EVIDENCE_MAP[crop_id][field] = {
            "value": value,
            "source": source,
            "locator": locator,
            "interpretation": interpretation,
        }


for _crop_id, _name, _family, _legume, _temp, _ph in (
    ("wheat", "Wheat", "Poaceae", False, (15, 23), (6, 7)),
    ("chickpea", "Chickpea", "Fabaceae", True, (15, 29), (6, 8.5)),
    ("maize", "Maize", "Poaceae", False, (18, 33), (5, 7)),
):
    _evidence(
        _crop_id,
        {
            "crop_name": _name,
            "family": _family,
            "legume": _legume,
            "temperature_min_c": _temp[0],
            "temperature_max_c": _temp[1],
            "ph_min": _ph[0],
            "ph_max": _ph[1],
        },
        ECO[_crop_id],
        "Taxon / Ecology: optimal temperature and soil pH",
        "Species-level optimal ranges; not the absolute survival limits or a local cultivar calibration.",
    )

_evidence(
    "wheat",
    {
        "region_ids": ["punjab_pk_demo_v1"],
        "planting_windows": [{"start_mmdd": "1101", "end_mmdd": "1215"}],
        "irrigation_required": True,
    },
    WHEAT_CALENDAR,
    "Recommended sowing times in Punjab irrigated areas",
    "Regional irrigated wheat profile; irrigated eligibility is intentionally conservative for the rainfed demo.",
)
_evidence(
    "maize",
    {
        "region_ids": ["punjab_pk_demo_v1"],
        "planting_windows": [
            {"start_mmdd": "0115", "end_mmdd": "0215"},
            {"start_mmdd": "0715", "end_mmdd": "0810"},
        ],
    },
    MAIZE_CALENDAR,
    "Farm Management Handbook p94 Table13: Faisalabad/Jhang, main improved varieties",
    "Use the named regional main-variety window; exclude later Agaiti-72/Sunehri exceptions.",
)
_evidence(
    "maize",
    {"irrigation_required": True, "nitrogen_demand": "high"},
    MAIZE_LOCAL,
    "Materials and Methods: Faisalabad irrigated spring/summer maize and fertilizer treatments",
    "High external-N input and irrigated management mapped to conservative screening classes.",
)
_evidence(
    "chickpea",
    {
        "region_ids": ["punjab_pk_demo_v1"],
        "planting_windows": [{"start_mmdd": "1025", "end_mmdd": "1025"}],
    },
    CHICKPEA_CALENDAR,
    "Abstract and Methods: PRI Faisalabad 2021–2023, October25 treatment",
    "Only the best supported local trial date is enabled; do not imply the poorer November dates are recommended.",
)

for _crop_id, _maturity, _water in (
    ("wheat", (120, 150), (450, 650)),
    ("maize", (125, 180), (500, 800)),
):
    _evidence(
        _crop_id,
        {"maturity_min_days": _maturity[0], "maturity_max_days": _maturity[1]},
        WATER,
        "Table4: indicative total growing period (grain maize; wheat)",
        "General indicative duration; cultivar and local weather can change maturity.",
    )
    _evidence(
        _crop_id,
        {"rainfall_min_mm": _water[0], "rainfall_max_mm": _water[1]},
        WATER,
        "Table5: total crop water need over the growing period, mm",
        "Explicit rainfed water-demand proxy; total water is not effective rainfall. Do not substitute annual Ecocrop rainfall.",
    )
_evidence(
    "chickpea",
    {"maturity_min_days": 90, "maturity_max_days": 180},
    ECO["chickpea"],
    "Cultivation: crop cycle",
    "Broad species duration, not an invented 90–130 day Punjab range.",
)
_evidence(
    "chickpea",
    {"rainfall_min_mm": 100, "rainfall_max_mm": 450},
    CHICKPEA_WATER,
    "Defining, Modeling, and Managing Water Requirement of Chickpea p73",
    "Reported seasonal water-use bounds. Stored moisture/irrigation contributes; use as a screening proxy only.",
)
for _crop_id in ("wheat", "maize"):
    _evidence(
        _crop_id,
        {"root_class": "deep"},
        ROOTS,
        "Table22: spring wheat 1.0–1.5 m; grain maize 1.0–1.7 m rooting depth",
        "Project depth classification: typical effective rooting begins at 1m; fibrous is architecture, not depth.",
    )
    _evidence(
        _crop_id,
        {"family_break_crops": 0},
        ROTATION,
        "Cereal rotation discussion and wheat/maize sequences",
        "Explicit policy: no unconditional cereal-family hard ban; diversification is handled by the later heuristic, not invented mandatory gaps.",
    )
_evidence(
    "wheat",
    {"nitrogen_demand": "high", "waterlogging_tolerant": False},
    ECO["wheat"],
    "Ecology: high fertility and well-drained soil",
    "Conservative class mapping from fertility/drainage requirements; not a fertilizer prescription.",
)
_evidence(
    "wheat",
    {"drought_tolerant": False},
    ROOTS,
    "Table24: spring wheat Ky=1.15",
    "Water-deficit-sensitive grain yield mapped to false; drought tolerance is not inferred from deep roots alone.",
)
_evidence(
    "maize",
    {"drought_tolerant": False, "waterlogging_tolerant": False},
    MAIZE_TOLERANCE,
    "Maize section",
    "Reported drought and waterlogging susceptibility.",
)
_evidence(
    "chickpea",
    {"nitrogen_demand": "low", "root_class": "deep", "drought_tolerant": True},
    CHICKPEA_MANUAL,
    "pp1,3: nitrogen fixation, deep tap roots and drought adaptation",
    "Lower external-N demand and deep-root/drought screening classes; tolerance never guarantees yield.",
)
_evidence(
    "chickpea",
    {"irrigation_required": False},
    "https://oar.icrisat.org/881/1/RA_000114.pdf",
    "A Case Study with Chickpea: Indian subcontinent cultivation on stored soil moisture",
    "Rainfed profile; supplementary irrigation may still help and adequate stored moisture is required.",
)
_evidence(
    "chickpea",
    {"waterlogging_tolerant": False},
    ECO["chickpea"],
    "Ecology: well-drained soil",
    "Conservative drainage requirement, not a quantitative flood-duration threshold.",
)
_evidence(
    "chickpea",
    {"family_break_crops": 6},
    CHICKPEA_MANUAL,
    "p12: fusarium-wilt management, exclude chickpea at least three years in infested fields",
    "Conservative project policy: three years approximated as six intervening crops at two crops/year. This count is NOT the source's unit; it cannot prove elapsed-time disease control.",
)


def load_catalog_json(path: Path) -> dict[str, JsonValue]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("Catalog must be an object")
    return document


def _number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def validate_mmdd(value: object) -> None:
    if not isinstance(value, str) or re.fullmatch(r"[0-9]{4}", value) is None or value == "0229":
        raise ValueError("Expected real non-leap four-digit MMDD")
    datetime.strptime("2023" + value, "%Y%m%d")


def validate_catalog_document(document: Mapping[str, JsonValue]) -> None:
    if set(document) != {"schema_version", "catalog_version", "region_id", "crops"}:
        raise ValueError("Invalid catalog fields")
    if (
        document["schema_version"] != "1.0.0"
        or document["catalog_version"] != "1.0.1"
        or document["region_id"] != "punjab_pk_demo_v1"
    ):
        raise ValueError("Catalog schema/version/region mismatch")
    crops = document["crops"]
    if not isinstance(crops, list) or not 1 <= len(crops) <= 12:
        raise ValueError("Expected 1–12 enabled crop records")
    seen = set()
    for crop in crops:
        if not isinstance(crop, dict) or set(crop) != REQUIRED_CROP_FIELDS:
            raise ValueError("Missing/unknown crop fields")
        crop_id = crop["crop_id"]
        if not isinstance(crop_id, str) or not crop_id.strip() or crop_id in seen:
            raise ValueError("Empty/duplicate crop_id")
        seen.add(crop_id)
        for field in ("crop_name", "family"):
            if not isinstance(crop[field], str) or not crop[field].strip():
                raise ValueError("Nonempty crop name/family required")
        regions = crop["region_ids"]
        if (
            not isinstance(regions, list)
            or not regions
            or any(not isinstance(r, str) or not r.strip() for r in regions)
            or len(set(regions)) != len(regions)
            or document["region_id"] not in regions
        ):
            raise ValueError("Invalid crop regions")
        windows = crop["planting_windows"]
        if not isinstance(windows, list) or not windows:
            raise ValueError("Nonempty planting windows required")
        for window in windows:
            if not isinstance(window, dict) or set(window) != {"start_mmdd", "end_mmdd"}:
                raise ValueError("Invalid planting window keys")
            validate_mmdd(window["start_mmdd"])
            validate_mmdd(window["end_mmdd"])
        if len({(w["start_mmdd"], w["end_mmdd"]) for w in windows}) != len(windows):
            raise ValueError("Duplicate planting window")
        if crop["root_class"] not in ("shallow", "medium", "deep") or crop[
            "nitrogen_demand"
        ] not in ("low", "medium", "high"):
            raise ValueError("Invalid root/nitrogen enum")
        for field in ("legume", "drought_tolerant", "waterlogging_tolerant", "irrigation_required"):
            if type(crop[field]) is not bool:
                raise ValueError("Boolean required")
        for field, low, high in (
            ("maturity_min_days", 1, 366),
            ("maturity_max_days", 1, 366),
            ("family_break_crops", 0, 8),
        ):
            if type(crop[field]) is not int or not low <= crop[field] <= high:
                raise ValueError("Invalid integer crop trait")
        for low_field, high_field in (
            ("maturity_min_days", "maturity_max_days"),
            ("rainfall_min_mm", "rainfall_max_mm"),
            ("temperature_min_c", "temperature_max_c"),
            ("ph_min", "ph_max"),
        ):
            low, high = crop[low_field], crop[high_field]
            if not _number(low) or not _number(high) or low > high:
                raise ValueError("Finite ordered range required")
        if crop["rainfall_min_mm"] < 0 or not 0 <= crop["ph_min"] <= crop["ph_max"] <= 14:
            raise ValueError("Invalid rainfall/pH range")
        refs = crop["references"]
        if (
            not isinstance(refs, list)
            or not refs
            or any(not isinstance(ref, str) for ref in refs)
            or len(set(refs)) != len(refs)
        ):
            raise ValueError("Nonempty unique HTTPS references required")
        for ref in refs:
            parsed = urlparse(ref)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or not parsed.path
                or parsed.username
                or parsed.password
                or any(c.isspace() for c in ref)
            ):
                raise ValueError("Real HTTPS citation required")
        evidence = EVIDENCE_MAP.get(crop_id)
        traits = REQUIRED_CROP_FIELDS - {"crop_id", "references"}
        if evidence is None or set(evidence) != traits:
            raise ValueError("Missing trait evidence")
        for field in traits:
            entry = evidence[field]
            if (
                set(entry) != {"value", "source", "locator", "interpretation"}
                or entry["source"] not in refs
                or not entry["locator"]
                or not entry["interpretation"]
            ):
                raise ValueError(f"Uncited trait: {crop_id}/{field}")
            if crop[field] != entry["value"]:
                raise ValueError(f"Trait differs from reviewed evidence: {crop_id}/{field}")


def test_committed_catalog() -> None:
    validate_catalog_document(load_catalog_json(CATALOG_PATH))


@pytest.mark.parametrize(
    "field,value",
    [
        ("root_class", "fibrous"),
        ("nitrogen_demand", "arbitrary"),
        ("maturity_min_days", "120"),
        ("maturity_min_days", True),
        ("maturity_max_days", 0),
        ("family_break_crops", 9),
        ("rainfall_min_mm", float("nan")),
        ("rainfall_max_mm", float("inf")),
        ("rainfall_min_mm", -1),
        ("rainfall_min_mm", 700),
        ("ph_max", 15),
        ("legume", 0),
        ("crop_name", ""),
        ("region_ids", []),
        ("planting_windows", []),
        ("references", []),
        ("references", ["http://example.com/source"]),
        ("references", ["https://example.com/source"]),
        ("temperature_max_c", 24),
    ],
)
def test_reject_invalid_or_uncited_trait(field: str, value: JsonValue) -> None:
    document = load_catalog_json(CATALOG_PATH)
    document["crops"][0][field] = value
    with pytest.raises(ValueError):
        validate_catalog_document(document)


def test_duplicate_ids() -> None:
    document = load_catalog_json(CATALOG_PATH)
    document["crops"].append(copy.deepcopy(document["crops"][0]))
    with pytest.raises(ValueError, match="duplicate"):
        validate_catalog_document(document)


@pytest.mark.parametrize("value", ["0229", "0230", "1301", "101", "abcd"])
def test_reject_bad_mmdd(value: str) -> None:
    with pytest.raises(ValueError):
        validate_mmdd(value)


def test_cross_year_mmdd_is_valid() -> None:
    validate_mmdd("1201")
    validate_mmdd("0131")


def test_missing_evidence_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    evidence = copy.deepcopy(EVIDENCE_MAP["wheat"])
    evidence.pop("ph_min")
    monkeypatch.setitem(EVIDENCE_MAP, "wheat", evidence)
    with pytest.raises(ValueError, match="Missing trait evidence"):
        validate_catalog_document(load_catalog_json(CATALOG_PATH))
