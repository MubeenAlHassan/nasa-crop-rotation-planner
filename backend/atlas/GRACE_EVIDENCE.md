# GRACE regional evidence — verified 13 November 2026

This archive provides historical regional terrestrial water-storage (TWS) context.
It never supplies crop-model forcing, rotation scores, field groundwater or stress diagnoses.

## Verified source and scientific-file inspection

Product: `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4`, CMR version
`RL06.3Mv04`, DOI `10.5067/TEMSC-3JC634`. Authenticated HTTPS acquisition succeeded:
`GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc`, 46,365,171 bytes,
SHA256 `3522dd579cc10326339efdecece550ba01f41b9bee599d0ed915fc35f9eafb64`.
The full file was created 10 November 2026 and contains 261 solutions spanning
April 2002–September 2026. Only nominal January 2005–December 2024 is processed.
CMR concept ID, canonical unsigned source URL, acquisition timestamp and hash are
retained in the receipt and public archive. Credentials and redirect URLs are not.

The file's `product_version=v3.0` attribute is inconsistent with its title/source,
CMR version and filename identifying RL06.3Mv04. Both identities are retained;
no silent metadata correction. Primary release notes confirm RL06.3M Version 4,
including October 2026 gridding/coastal-scale-factor corrections. Capture freezes
this complete release: later releases can revise historical months because the
provider solution uses temporal constraints.

Actual inspected schema:

| Variable | Dimensions / encoding | Meaning |
|---|---|---|
| `lwe_thickness` | time=261, lat=360, lon=720; float64; cm; fill −99999 | CRI-filtered liquid-water-equivalent thickness anomaly |
| `uncertainty` | same; float64; cm; fill −99999 | Provider 1-sigma per **3-degree mascon**, repeated across output cells |
| `time`, `time_bounds` | 261, 261×2; days since 2002-01-01T00:00:00Z; Gregorian | Representative time and first/last included time; bounds are retained inclusive |
| `lat`, `lon` and bounds | centers −89.75…89.75, 0.25…359.75; 0.5° spacing | Native posting; longitude normalized to −180…180 for display |
| `mascon_ID` | 360×720, IDs 1…4551 | Native estimate identity, not independent output pixels |
| `land_mask` | 360×720, binary | CRI land mask; every selected cell is 1 |
| `scale_factor` | 360×720, dimensionless, fill −99999 | Optional CLM 2002–2009 gain factors; retained **unapplied** |
| `GAD` | time×lat×lon, cm, fill −99999 | Ocean/atmosphere de-aliasing model; not added to this inland calculation |

No packing scale or offset is present on thickness/uncertainty; cm→mm multiplies
by 10. File time-mean reference is **2004.000–2009.999**, not the 2005–2024 display
period. GIA ICE6G-D correction and CRI coastal treatment are already applied.
No second smoothing, CRI correction or ocean GAD adjustment is performed.
Finite/native-fill checks, nonnegative uncertainty and land-mask checks are used;
this product has no cloud-style retrieval QA flags. Source uncertainty already
reflects the provider's accelerometer degradation treatment. These are not locally
calibrated confidence intervals.

Primary sources checked 13 November 2026:
- [PO.DAAC product](https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4)
- [JPL native-support, scaling and uncertainty guide](https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/)
- [Current release notes](https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-docs/gracefo/open/docs/GRACE_GRACE-FO_ReleaseNotes_JPL_MASCON.txt)

## Region, aggregation and uncertainty

Reversible analysis choice: select complete native mascon IDs whose output-cell
centers intersect the seed box 96–91°W, 40–44°N around Iowa. Retain **all cells** of
those mascons, not just the seed-box intersection. Result: IDs 683, 684, 771, 772,
863, 864; 294 native postings; **675,025.81 km²**, extending approximately
98.5–89°W and 37.5–46.5°N. It is a Midwest exploratory context region, not a
hydrological basin. The map shows the actual union and field location. A field
outside the region is explicitly not associated. Editing the farm does not alter
GRACE support. GRACE cannot resolve changes inside the pilot field.

The union contains complete inland mascons and avoids introducing model-based
sub-mascon spatial allocation. Hence optional CLM gain factors remain unapplied.
Their actual values are retained for provenance, not used as observational precision.
Native 3-degree equal-area mascons span hundreds of kilometers. CRI reduces coastal
leakage; it does not eliminate inland leakage, regularization or model errors.
The source's 0.5° grid is a representation of these estimates, not finer evidence.

Areas use WGS84 geodesic native-cell polygons, summed within each mascon. These
approximate the provider support through its posted mask; they are not newly
inferred hydrological boundaries. Within each selected mascon, actual source values
and uncertainties are identical across cells (checked before collapse).
Let `w_m=A_m/sum(A)`; regional anomaly is `sum(w_m*x_m)` in mm. Every selected
mascon must have valid values; missing support withholds the regional mean rather
than changing the region opportunistically.

The complete error covariance is unavailable. We export native sigma and
`sum(w_m*sigma_m)` as a **perfect-positive-correlation bound on represented random
standard deviation**, via the triangle inequality. This avoids an independent-cell
or independent-mascon assumption. It is not total predictive uncertainty, a
probability interval, or a bound on systematic/leakage errors. We do not divide by
sqrt(pixel count), average sigma across months into a confidence interval, or fit
an unqualified trend. Unknown covariance and temporal constraints remain explicit.

## Dates, missingness and seasonal summaries

210 accepted solutions and 30 absent months during 2005–2024. The July 2017–May
2018 mission gap and other missing months (including August/September 2018) remain
null with reasons. No zero filling/interpolation. Actual bounds are preserved,
including the source's fractional last-day timestamp (23:59:59.913600).

Some source times do not fall in their nominal solution month: December 2011 has
representative time January 1, 2012; May 2015 is represented April 27. Therefore
nominal labels are reconstructed from the provider coverage sequence excluding
`months_missing`, checked against source count, ordering and bounds. They are not
assigned by rounding representative dates. Intervals can overlap; no summation or
calendar-day redistribution is performed.

Descriptive seasonal history groups available nominal calendar months over
2005–2024, reporting count, mean, observed minimum and maximum. Uneven counts and
shifted intervals remain disclosed. These ranges are neither uncertainty intervals
nor forecasts; the original 2004–2009 anomaly baseline is unchanged. No trend or
trend significance claim is emitted.

TWS combines groundwater, soil moisture, snow and surface water. Groundwater
inference would require other storage components with matched regional/time support,
consistent anomaly baseline and propagated correlated uncertainty. SMAP, IMERG,
POWER and ECOSTRESS represent different stores/fluxes and supports; environmental
co-variation, shared meteorology and processing prevent treating agreement as
independent validation or a causal rotation effect.

## Reproduction and integration

```bash
python backend/atlas/grace_acquire.py
python backend/atlas/grace_process.py
python backend/atlas/grace_process.py --out /tmp/grace-replay/grace
python -m unittest discover -s backend/atlas -p 'test_grace.py'
```

Use the existing evidence environment (earthaccess, python-dotenv, requests, h5py,
numpy, pyproj). Acquisition is a single serial scientific-file request with atomic
installation and checksum-verified cached resume; partial transfers restart. Release
notes and discovery are retained privately. No six-hour seasonal job is invoked.
Processing is network-free; representative tests independently read native arrays
and replay full outputs byte-for-byte.

The derived archive is 183,246 bytes at `/atlas/grace/iowa-region.json`, with a small
checksummed `grace-index.json`. API `/api/atlas/grace?field=iowa-demo` serves validated
regional evidence (other field IDs return 404); ETag supports conditional replay.
The field parameter identifies the pilot context archive, not field measurements.
The same static archive supports the standalone distribution. Only the index enters
the automatic offline core. Full data require explicit Load / Save offline; Remove
clears the dedicated cache. Reload verifies checksum before numerical display.
Browser eviction remains possible. Exports retain the full `graceEvidence` object
separately from forcing, local history, seasonal NASA evidence and model results.

Remaining scientific work: region sensitivity/basin comparison, uncertainty covariance
and leakage assessment, independent regional water-budget evaluation. Any trend would
need a predeclared seasonal model, gap handling, temporal dependence and diagnostics.
Neither these software tests nor historical contextual agreement establishes calibrated
agronomic projections or groundwater attribution.
