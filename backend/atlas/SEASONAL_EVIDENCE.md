# Multi-month regional evidence — implementation 14 November 2026

The authorized capture spans March–November 2024. **Use the published index and
campaign checkpoint for actual completed months; authorization is not coverage.**

Verified 14 November 2026: all nine months acquired, processed and replayed, with
13,200 IMERG intervals, 2,200 GPH means, 2,200 AUP snapshots and 275 L3 daily files.
Selected subsets total 960,038,056 bytes; public monthly packages 30,854,416 bytes.
Thirteen older processing candidates remain excluded with provenance. Nearest
pilot L3 remains 0/550 accepted; no QA relaxation or calibration claim. Both
production and standalone static nine-package offline workflows pass, including
removal, corruption, partial totals and exports. See IMPLEMENTATION_PLAN.md for
QA counts and the separate requirements before scientific or production reliance.
The existing POWER forcing, scoring, ECOSTRESS observations and GRACE region are
unchanged. No stress/cover classifier or calibrated agronomic benefit is enabled.

## Acquisition and checkpointing

`nasa_season_campaign.py` runs months sequentially, reusing existing June and other
subsets by checksum. `nasa_season_acquire.py` uses no more than two workers,
0.25-second spacing after successful requests, bounded retries and provider
Retry-After handling. Scientific subsets retain native indices, product/version,
unsigned source URLs, acquisition times and SHA256. No full-global download or
product substitution is made. Rejected observations retain their original reasons.

Each month is processed into an isolated staging directory and independently replayed
before atomic archive/index publication. Partial acquisition remains explicit;
provider access/rate failures stop the campaign after preserving available results.
Per-file receipts survive interruptions, product-level summaries checkpoint every
20 outcomes, and failed attempts from the updated acquisition script additionally
enter private `failure-history.jsonl`. Current monthly summaries are not a substitute
for that historical audit. Cached file reuse is verified, not assumed.

```bash
# If the temporary environment was lost between sessions:
python3 -m venv /tmp/fieldshift-evidence-env
/tmp/fieldshift-evidence-env/bin/pip install earthaccess h5py numpy requests python-dotenv rasterio shapely pyproj
# Run only one campaign process at a time; first check the existing process/checkpoint.
/tmp/fieldshift-evidence-env/bin/python backend/atlas/nasa_season_campaign.py
# Independent arithmetic and replay of all currently published months:
/tmp/fieldshift-evidence-env/bin/python backend/atlas/verify_nasa_campaign.py
```

Private checkpoint: `backend/.provider_cache/nasa-season/campaign-2024.json`.
Sanitized logs: `YYYY-MM-campaign.log` in the same directory. Resume does not discard
completed months or receipted subsets. A complete March–November capture expects
275 L3 daily files / 550 AM-PM slots, 2,200 L4 GPH means, 2,200 AUP snapshots and
13,200 IMERG half-hour intervals: 17,875 source subsets. Expected counts do not imply
valid observations. About 58 GiB was free at resume; historical measured subsets
suggest about 1 GB total, with roughly 30 MB of compact JSON. Actual bytes and counts
are recorded after each month. The earlier six-hour estimate remains an estimate.

## Cross-month arithmetic

`seasonalWindow` is the single application implementation for UI and report window
summaries. Inputs are checksum/schema-validated monthly packages and a UTC half-open
interval `[start,end)`. Reviewed date-only windows include the end date by setting
end to the following UTC midnight. Epoch arithmetic avoids local-time/DST errors.

Exact duplicate source observations are counted once. Conflicting duplicates or
nonidentical overlapping intervals fail rather than silently selecting a value.
Native geometry, region and processing policy must agree across packages.

For each interval `i`, `dt_i` is its overlap with the requested window in seconds.
IMERG accumulation is `sum(rate_i * dt_i / 3600)` in mm. Expected seconds, acquired
seconds and valid seconds are separate. Acquired-minus-valid is rejected time;
expected-minus-acquired is missing time. A total is enabled only with complete valid
time. Otherwise the observed partial accumulation remains labeled; zero is never
inserted for missing rain. If no valid time exists, partial accumulation is null.
Partial-edge weighting assumes a constant mean rate within the native half hour;
it is not a finer-time rainfall observation.

L4 surface/root-zone means use `sum(value_i * dt_i) / sum(dt_i)` in m³/m³.
The observed-support mean and complete-window mean are distinct: the latter is null
unless valid support covers the full window. Weighting part of a three-hour mean
assumes uniform interval support; it cannot reconstruct subinterval fluctuations.
L4 is regional land-model assimilation, not field/root-depth sensor measurement.

L3 remains instantaneous surface retrieval evidence. Values are selected using their
actual UTC observation time, independently of the nominal source daily slot. Daily
AM/PM slot counts, missing observation times, timed observations and accepted counts
are separate. Any displayed retrieval average weights valid observations equally;
it is **not** a duration-weighted moisture mean. Neighboring-month packages can be
needed for observations whose timestamp crosses a catalog-date boundary; missing
packages do not imply an observed dry state.

AUP analysis-snapshot ensemble spread remains in the individual snapshot records.
Window summaries count available/valid diagnostics but never attach their spread
to GPH means or compute a confidence interval. No independence assumption is made
for correlated products, repeated grid cells, or consecutive observations.

## Farmer workflow and reproducibility

The coverage table distinguishes published acquisition, QA-valid L3 cell-times,
loaded packages and device-cached packages. Daily maps/timelines retain native
regional cells and show selected-month QA. A reviewed window can request all of its
available months; unavailable/offline months remain explicit. Boundary-mismatched
history is withheld from both UI window comparison and exported summaries.

Each month has explicit Save/Remove controls. No monthly package is auto-installed.
Removing a month also unloads it from comparisons and reports. Loading verifies its
hash against the index; a stale/corrupt cached copy is removed and retried online,
otherwise numerical evidence stays unavailable. The small index refreshes online
and falls back to its last cached copy offline. Browser storage eviction remains
possible. Month acquisition status does not mean that the device has saved it.

Exports preserve `regionalSeasonalEvidence` for backward compatibility (selected
month), plus all `regionalSeasonalPackages` and `crossMonthWindows`. The latter is
computed with the same function used by the UI. Missing packages remain missing
in reports. ECOSTRESS comparison selects a loaded monthly package only when its
actual thermal overpass lies within that month; no ET or temperature dates are
interpolated. GRACE's regional support and anomaly reference remain unchanged.

`verify_nasa_campaign.py` independently checks every published daily accumulation
and root mean for all nine cells, then reproduces monthly processing byte-for-byte.
Unit tests exercise partial UTC boundaries, missing/rejected intervals, duplicate
handling, observation-time selection and separation of snapshot uncertainty.
Browser coverage includes two-month windows, package save/replay/removal, missing
packages, export consistency, edited-boundary withholding and tablet/phone layout.
Verification success is recorded in the implementation plan only after the actual
checks finish; it is not scientific calibration.
