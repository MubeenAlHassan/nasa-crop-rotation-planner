# Phase 0 verification

Scope: FS-03 through FS-07, source verification and immutable fixture caching.
The scripts use `pydantic.JsonValue` and do not import application contracts,
domain models, routes, features, or scoring modules.

## Reproduce the checks

Use Python 3.11.13 (`.python-version`). Install the pinned dependencies from the
repository root into a fresh virtual environment:

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python backend/scripts/verify_phase0.py
.venv/bin/ruff check backend/scripts backend/tests/test_spec_audit.py
.venv/bin/ruff format --check backend/scripts backend/tests/test_spec_audit.py
```

The verification runner collects all five Phase 0 scripts plus
`backend/tests/test_spec_audit.py`, and blocks external socket connections.
No tests download data or rewrite committed fixtures. Capture is a separate,
explicit CLI operation. HDF5 test files are synthetic, sparse inputs created in
pytest temporary directories; they are never committed as observations.

The independent audit retains its invalid-moisture assertions. Because the real
SMAP cache is now honestly unavailable, those assertions use an explicitly
synthetic, otherwise valid SMAP sample. They first verify that the sample is
accepted, then assert rejection of NaN/out-of-range values. Its wrong-product
test now supplies the specified farm ID. Its cross-farm test copies the catalog
and validates the temporary workspace before tampering, preventing a missing
catalog from accidentally satisfying the expected failure.

## Release fixture

- Farm/fixture: `faisalabad_2025`; WGS84 latitude 31.4504, longitude 73.1350.
- Assessment: 2025-10-15; POWER observations: 2025-07-18 through 2025-10-15.
- Baseline: 30 complete calendar years, 1991 through 2020, including leap days.
- Slot: `rabi_2025`, 2025-11-01 through 2026-03-31.
- POWER: all 31 genuine response objects recaptured for this point/periods. Query
  pairs and retrieval timestamps are retained. Raw provider geometry is rounded
  to three decimals; it is checked against that documented response precision
  without relabeling or modifying the payload. Declared fill values stay raw.
- SoilGrids: the single official REST probe timed out. `available=false`, empty
  layers, real attempted REST endpoint, UTC capture timestamp, explicit reason.
  No invented WCS requests or zero-filled successful profile is substituted.
- SMAP: no authorized, provenance-verifiable Version 6 granules supplied.
  `available=false`, null cell, empty granules/current/reference arrays, explicit
  reason. Previous unsupported observations have been removed.
- Catalog version: `1.0.1`; wire schema version remains `1.0.0`.

Both optional unavailable archives are allowed by the frozen Phase 0 contract.
Required POWER acquisition fails closed and leaves any previous file untouched.
GET attempts share a cancellable deadline of at most eight seconds; POWER has
at most two attempts and SoilGrids probes once. Tests cover retries, 429 delays,
5xx/other 4xx, timeout clamping, and a slow stream that outlives the deadline.

The manifest checks hashes **and** all producer validators, catalog evidence,
availability, exact file sets, versions, identity, dates and location. Validation
is read-only. Regeneration is explicit after an authorized fixture change:

```sh
.venv/bin/python backend/scripts/test_fixture_manifest.py --build
```

## Catalog evidence limits

`EVIDENCE_MAP` in `backend/scripts/test_crop_catalog.py` binds every enabled trait
to its reviewed value, cited source, section and interpretation. Missing evidence,
uncited references or changed values fail validation; changing traits requires
reviewing the ledger and bumping the catalog version.

The sources combine regional calendars/trials with species-level agronomy.
The single chickpea planting date is the supported PRI Faisalabad trial date,
not an invented October-to-November recommendation. Root architecture labels
such as fibrous/tap have been replaced by the required depth classes.

Water ranges are explicitly sourced **seasonal water-demand screening proxies**:
they are not annual rainfall, measured effective rainfall, or locally calibrated
yield thresholds. Stored soil water and irrigation can contribute. N-demand,
root-depth, tolerance and family-break classifications are documented heuristic
mappings. In particular, the chickpea crop-count break approximates a cited
three-year disease break at two crops/year; it does not establish elapsed-time
disease safety. No scoring engine or frontend behavior is implemented here.
