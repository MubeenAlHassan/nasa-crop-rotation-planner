# Iowa native-support evidence capture

Verified against primary documentation on **2026-11-07**. This is a small,
reproducible evidence integration, not a crop-history classifier or validated
agronomic inference. The demonstration rectangle is not a confirmed farm.

```sh
python3 -m venv /tmp/fieldshift-evidence-env
/tmp/fieldshift-evidence-env/bin/pip install -r backend/atlas/requirements-evidence.txt
/tmp/fieldshift-evidence-env/bin/python backend/atlas/field_evidence_capture.py --include-elevation
/tmp/fieldshift-evidence-env/bin/python backend/atlas/field_evidence_capture.py --offline
/tmp/fieldshift-evidence-env/bin/python -m unittest discover -s backend/atlas -p 'test_*.py' -v
```

Acquisition is read-only and uses public Microsoft Planetary Computer Landsat
assets and USDA NRCS Soil Data Access (SDA). NASA Earthdata credentials were not
available during implementation; other NASA products remain explicitly pending.
The first remote download encountered the provider's HTTP 429 limit; the capture
now reuses the authorized per-container read token in memory and retries transient
responses. No token or signed URL is written to the archive.

## Stored package

`frontend/public/atlas/field-evidence.json` has `schemaVersion=field-evidence-v1`:

- `field`: WGS84 polygon, bounding box, projected area, confirmation status.
- `datasets[]`: ID, available/pending/excluded status, evidence kind, exact
  product/version, source URL, spatial support, dates, units, QA, summaries,
  limitations, assets and their checksums.
- `observations[]`: acquired Landsat item IDs, UTC overpass times, valid-area
  fraction, QA policy, field NDVI and BSI (null below 80% valid area), and an
  explicitly withheld bare-soil/residue classification.
- `map`: GeoJSON FeatureCollection, with `properties.layer` equal to `soils` or
  `landsat`. All polygons are clipped to the demo field. Landsat features contain
  NDVI/BSI or null, a validity flag, and acquisition date; soil features contain
  actual map-unit identifiers, names and area.
- `provenance`: acquisition-script checksum, primary references, verification
  date, transformation description and credential policy.

`field-evidence.geojson` repeats the map collection for standard GIS tools.
`evidence-raw/` contains the actual encoded Landsat native-grid pixel windows,
unsigned source metadata, capture metadata/checksums, and actual SDA responses
and SQL requests. These are archived windows, **not complete Landsat scenes**.
An offline rerun reprocesses these local files and does not contact the provider.

## Scientific contracts

Landsat Collection 2 Tier 1 OLI bands 2, 4, 5, 6 map to blue, red, NIR and SWIR1.
Fill DN 0 is rejected **before** scaling by 0.0000275 and adding -0.2. QA_PIXEL
rejects fill, dilated clouds, cirrus, cloud, shadow, snow, water and medium/high
cloud confidence; QA_RADSAT must be zero; aerosol must be low/medium and either directly retrieved or spatially
interpolated by LaSRC, never climatology/high aerosol, water or fill. The direct
retrieval and interpolated-aerosol area fractions remain separately visible.
The initial direct-retrieval-only policy retained only 6–7% of the field: the
product's aerosol estimates are routinely spatially interpolated. The revised
policy explicitly preserves that quality distinction rather than calling all
interpolated surface-reflectance pixels invalid. These conservative policy
choices can discard usable observations; they are not claims of perfect cloud
screening. A separate conservative plausibility screen requires reflectance in
[0,1]. Pixel/field intersections supply area weights in native EPSG:32615.

NDVI = (NIR-red)/(NIR+red).
BSI = ((SWIR1+red)-(NIR+blue))/(SWIR1+red+NIR+blue).
No index threshold is used to infer soil exposure, residue, crop identity or
rotation. Even a seasonal series cannot establish bare-field duration without
matched labels and independently validated detection.
Native pixel size remains 30 m; geolocation and mixed-pixel uncertainty persist.

SSURGO horizon AWC is a representative volume fraction. For the fixed 0–100 cm
profile, sum `awc_r * supported_horizon_thickness_cm * 10` to get millimetres.
Missing or overlapping horizons withhold a component value. At least 80% known
component proportion is required per map unit, and 80% mapped-field support is
required for the conditional area-weighted summary. The coverage fraction is
always retained; missing soil/water areas are not treated as zero AWC. This is
survey-estimated potential storage, not current water or measured field capacity.
The soil layer must not silently change the model's rooting depth or extrapolate
a one-metre profile to 1.5 m. Farmer/local-soil review remains necessary.

Map-unit component locations are unknown within each polygon. Actual survey
geometry includes mapped water and heterogeneous terrain: boundary confirmation
is necessary before interpreting this as a farm. Soil properties and Landsat
vegetation are not evidence of profitability, pathogens, nitrogen supply, SOC
change, or causal rotation benefits.

## Primary documentation

- [USGS reflectance scaling and product](https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-reflectance)
- [USGS Collection 2 QA bit definitions](https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands)
- [Microsoft official public access/signing](https://planetarycomputer.microsoft.com/docs/concepts/sas/)
- [NRCS SDA service and JSON response contract](https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx)
- [NRCS spatial SQL functions](https://sdmdataaccess.nrcs.usda.gov/documents/AdvancedQueries.html)
- [SSURGO horizon definitions, including AWC](https://www.nrcs.usda.gov/sites/default/files/2022-08/SSURGO-Metadata-Table-Column-Descriptions-Report.pdf)

## Original capture outcome (2026-11-07; seasonal extension below supersedes counts)

Three native Landsat windows were acquired: 15 March, 26 June and 7 September
2024. Final valid field fractions are 74.415%, 86.047% and 86.080%; the March field
mean is withheld below the 80% threshold. Summer and September NDVI summaries
are evidence of vegetation reflectance only, not crop identification. The map
uses the latest acquired date and visibly retains rejected cells.

Ten actual SSURGO map units cover the rectangle. The 0–100 cm conditional
component/area-weighted AWC is 186.40 mm on 92.5267% supported area; the remaining
area includes mapped Water and Orthents with unavailable AWC. Mapped water is
2.9413% of the rectangle. Survey area IA169 has source revision 8 September 2026.

A native NASADEM_HGT_n42w094 height window was acquired and inspected. Integer
metres relative to EGM96 have 100% non-fill coverage in the subset; the local
range is 280–303 m. NUM source-class and SWB water layers are absent from this
mirror, so this is limited terrain context, not a validated bare-earth terrain,
frost-pocket or soil-loss product. No resampling is applied.

The public Microsoft IMERG catalog describes Version 06 ending 31 May 2021,
so it was not passed through a V07 adapter. MOD09A1.061/MOD13Q1.061 and NASADEM
have public catalog access; MODIS is deferred because of strong mixed-field
support. That historical capture checkpoint preceded authenticated SMAP, ECOSTRESS
and GRACE delivery. Current product coverage and verification are in
`docs/IMPLEMENTATION_PLAN.md`, `ECOSTRESS_EVIDENCE.md` and `GRACE_EVIDENCE.md`.
GEDI remains excluded for annual-crop scoring. No pending product supplies
numeric field observations in this package.

## Seasonal continuation — completed 2026-11-09

The three selected-scene demonstration is replaced by seasonal exploration. The
initial March–September snapshot retained 51 catalog items. A fresh public STAC
query extended the default season to **1 March–30 November 2024**: 66 discoveries,
53 acquired Tier 1 native windows, 17 usable field summaries, 36 QA-withheld
summaries and 13 explicitly excluded Tier 2 acquisitions. No acquisitions failed
in this capture. Query and source retrieval timestamps are archived; catalog
completeness refers to that captured response, not guaranteed sensor availability.

Discovery follows pagination and retains Tier 2 exclusions, failed acquisitions
and QA-withheld dates. All Tier 1 native windows are attempted regardless of scene
cloud percentage. Scene cloud metadata never substitutes for pixel/field QA.
Original three-date and March–September raw inputs remain retained.

```sh
# Reproduce or acquire the configured season for this same pilot.
# Use --out /tmp/another-season to preserve a different reviewed package.
# --refresh explicitly re-queries sources.
/tmp/fieldshift-evidence-env/bin/python backend/atlas/field_evidence_capture.py --start 2024-03-01 --end 2024-11-30
/tmp/fieldshift-evidence-env/bin/python backend/atlas/modis_capture.py --start 2024-03-01 --end 2024-11-30
# Rebuild the combined package after optional context is captured:
/tmp/fieldshift-evidence-env/bin/python backend/atlas/field_evidence_capture.py --offline
/tmp/fieldshift-evidence-env/bin/python backend/atlas/modis_capture.py --offline
```

`--start` and `--end` are inclusive UTC discovery dates, at most 367 days.
`--out /tmp/another-season` selects a separate archive. The fixed Iowa boundary
remains intentional: new field polygons require a new spatial capture adapter.
The application filters this captured season offline; it does not silently
perform live acquisition when its date controls change. Dates outside the pack
have no satellite evidence. There is no interpolation across cloud/revisit gaps.

Each observation retains `nativeSupportM`, platform, overpass timestamp, QA
policy, valid-area fraction (null when not processed), assets and a dated
`mapAsset`. `history-maps/` contains actual clipped native pixel footprints for
**each processed date**, including masked pixels. The evidence API returns the
full seasonal package. The latest processed map stays available in the overview;
history maps load by date, check the recorded hash and cache on first use. The
observation timeline and metadata are part of the core offline pack.

Low NDVI pairs only generate explicitly uncertain review intervals; no bare soil,
residue protection or continuous ground condition is inferred. Local records
must distinguish bare soil, residue, living/sparse vegetation, water and mixed
cover at the same date/support. Farmer confirmation is a reported condition, not
independent validation. Historical weather overlap uses unmodified POWER UTC
days with separate rainfall/Tmax missingness; no gap is silently filled with zero.

## MODIS regional context

The public [NASA ORNL REST service](https://modis.ornl.gov/data/modis_webservice.html)
provided real MOD13Q1 subsets after SMAP/IMERG/ECOSTRESS/GRACE authentication was
found unavailable. The actual CSV granule IDs establish **Collection 061**;
short-name metadata alone is insufficient. Every encoded CSV pixel is compared
with its JSON counterpart before a composite can be processed. Inputs, request
URLs/times, hashes, exact band metadata and pipeline hash are retained.

Sixteen complete 16-day composites lie within the requested season, from
5 March through 15 November 2024. Four regional means are withheld below 80%
valid support; twelve pass this conservative QA policy. The final composite has
zero accepted pixels, null indices and null selected-pixel dates. Boundary
composites extending beyond 30 November are excluded; edge days remain missing. This is a 9×9-cell, 4.346838
km² neighborhood around the pilot, not the field average. Native sinusoidal
postings are 231.656358264 m (nominal 250 m). No upsampling, downscaling, sensor
fusion or additional independent samples are implied.

The [MOD13 Collection 6 user guide, tables 2/4/5](https://lpdaac.usgs.gov/documents/103/MOD13_User_Guide_V6.pdf)
and current REST band metadata support VI scaling 0.0001, offset zero, fill
−3000, valid encoded range −2000…10000. The conservative local policy accepts
pixel reliability 0, MODLAND 0, usefulness 0–2, low/intermediate aerosol and land,
with no adjacent/mixed cloud, snow or shadow. Selected pixel day-of-year must lie
inside the composite. It is retained as actual selected-date min/max; the
composite start date is not an overpass or an average of every day. These
composites select favorable observations and cannot independently validate
Landsat-derived windows. MOD09A1 is still an unimplemented alternative, not an
acquired layer. Current identifiers are verified through
[NASA MOD13Q1.061 metadata](https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061).

`modis-context.json` is integrated into the main evidence registry/API/report
when available. Its UI is explicitly regional, including when a farmer edits
field boundaries. It never supplies a bare-field label or rotation score.
See [exact pending-source setup](EARTHDATA_SETUP.md) for remaining access gates.


## Reproducibility checks — 2026-11-09

Eleven Python checks verify scale/offset, QA, missing horizons, pagination, every
catalog date, source asset hashes, map date/area correspondence, MODIS JSON/CSV
identity and withholding. Independent offline replay into a fresh directory
reproduced all 56 outputs byte-for-byte: combined JSON/GeoJSON, MODIS context,
and 53 dated maps. All 12 original POWER raw-response hashes still match.
This demonstrates reproducibility of software and archived inputs, not field
accuracy or calibrated classification.


## Multi-year continuation — 12 November 2026

The protected SMAP/IMERG sources returned HTTP 401 without credentials. Public
fallback acquisition added a separate POWER 2005–2024 archive and a bounded
April 2023 Landsat season. Original 2024 field JSON/GeoJSON and the original
2013–2024 simulation weather are preserved.

```sh
python3 backend/atlas/power_history_capture.py
/tmp/fieldshift-evidence-env/bin/python backend/atlas/season_capture.py --start 2023-04-01 --end 2023-04-30
# Both commands accept --offline for deterministic archive-only replay.
```

`power-history.json` contains 7,305 UTC daily rows, zero missing required values,
and all twenty provider-response hashes/metadata. Eight new yearly responses
(2005–2012) use the existing point/AG parameters and UTC setting. The actual
response dates, coordinate, source families, fill values and units were inspected.
PRECTOTCORR is mm/day; Tmin/Tmax °C; RH %; 2 m wind m/s; radiation MJ/m²/day
(or explicitly converted from kWh/m²/day). Fill -999 becomes null. The original
4,383 overlapping daily rows match exactly. New raw receipts record acquisition
day; precise request times were not instrumented. No station accuracy is implied.
The [POWER daily API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
was checked 2026-11-12 for availability and explicit UTC selection. Only actual
returned parameter/date coverage is asserted here.

The history API `/api/atlas/history` and cached static fallback supply this
regional baseline. The interface compares the same selected month/day interval
across years, shows valid-day counts and withholds incomplete totals. Invalid
Feb 29 in non-leap years remains missing; cross-year periods extending outside
the archive are incomplete. A mean uses only complete rainfall periods and states
its denominator. Rotation scores continue to use the unchanged `iowa.json`.
Exports distinguish historical-weather provenance from simulation forcing.

`landsat-seasons.json` registers April 1–30, 2023: seven discoveries, five actual
Tier 1 native windows, two usable summaries, three QA-withheld summaries and two
Tier 2 exclusions. Each acquired date has a native map. Existing files are reused
on resume; missing failed acquisitions are retried on a connected run. Offline
replay requires archived files or an explicit prior acquisition-failure record.
Only nonoverlapping registered periods with identical pilot boundary and QA policy
are accepted. No intervening months or years are implied to have been acquired.
The API and static loader share one merge implementation, retaining 73 total
catalog entries across the two captured periods, without altering the overview map.

Captured-period buttons, dated observation tables/maps, source assets, weather
context, exports and core offline caching use the combined evidence. Native maps
cache on first view. Automatic soil/residue classification remains withheld;
no new review windows are manufactured to fill the interface. The 2023 example
is an acquisition/QA demonstration, not validation across agricultural years.


## Authenticated regional NASA slice — 12 November 2026

The former Earthdata access gate is resolved. Use `acquire_nasa_pilot.py` with
`--product smap`, `smap-rootzone`, or `imerg`; it loads ignored `.env` explicitly,
resumes cached native HDF5 files, and suppresses credential-bearing library output.
`nasa_context.py` processes those files offline. The public `nasa-context.json`
contains three independent product structures (not statistically independent
measurements): L3 surface retrieval, L4 surface/root-zone assimilation and IMERG
Final merged precipitation. Fifty native subset JSON assets retain array metadata,
coordinates, unscaled values, full-file hashes and source identifiers.

June 1 2024 coverage: one L3 day with AM/PM per-cell observation times; one L4
00:00–03:00 UTC mean; forty-eight IMERG half-hours. No other dates are filled.
The earlier L4 21:00–00:00 representative file is retained privately for audit but
excluded from June 1 processing. L4 extent metadata is authoritative for the
UTC interval; raw J2000 metadata is preserved rather than naively converted.

L3 requires recommended retrieval bits, no adverse surface flags, valid native
range and observation time; the nearest pilot cell is withheld in both passes.
L4 is checked against native fill/range only and remains explicitly modeled.
Its GPH file lacks the selected error fields; no error interval is invented.
IMERG rates use actual `time_bnds` duration, with null for missing/nonfinite/negative
rates. A missing interval withholds the full total; partial totals disclose coverage.
Quality index and product RMS error are shown separately, not treated as calibrated
certainty. Correlated errors are not summed independently. Native unit attributes
and implicit scale 1 / offset 0 are verified; no generic band names are assumed.

All three are regional context, displayed separately from Landsat and farmer
records. The original POWER simulation input is byte-unchanged. L4 metadata lists
IMERG-derived precipitation forcing, so cross-product agreement is not independent
confirmation. No field-scale moisture, irrigation prescription or agronomic benefit
claim is enabled. Broader seasonal capture and independent calibration remain open.

Offline processing was replayed into a fresh directory: all 51 outputs were
byte-identical. Browser checks cover native grids, dates, QA, selected-period
coverage, exports, missing context, phone/tablet layout and service-worker replay.
