# ECOSTRESS pilot evidence — verified 13 November 2026

This increment adds historical evidence only. Rotation scoring, simulation forcing,
soil/management assumptions and the resumable March–November NASA expansion are unchanged.

## Coverage and version selection

CMR was queried for `[-93.66,42.015,-93.64,42.035]` for both currently listed
Collections 002 and 003. June 2024 returned 17 `ECO_L2T_LSTE.002`, two
`ECO_L3T_JET.002` and two `ECO_L4T_ESI.002` granules; all three Collection 003
queries returned zero. Selecting Collection 002 is explicit, not a claim it is the
newest collection. The catalog is retained privately, and its inventory is exported.

All June LST granules were acquired: June 2; June 8 (two scenes); June 11 (two);
June 12 (two); June 15, 20, 23, 24, 25, 26, 27, 28, 29 and 30. Scene overlap is
not independent evidence. Two produce usable field summaries under the stated QA:
**June 11, 20:52:16.817099 UTC** and **June 23, 16:04:21.157635 UTC**. Each has
100% accepted intersection area. The other 15 have zero accepted field area and
remain retained, not filled/interpolated.

JET and ESI exist on **June 27, 14:28:27.768293 UTC** and **June 28,
13:40:16.871530 UTC**, but both have zero accepted field area. No numerical June
ET/ESI field summary is enabled. The nearest available alternative outside June in
the March–November discovery is **May 23, 21:51:56.656661 UTC** (before June;
next post-June ET/ESI is July 22). May 23 LST/JET/ESI were acquired and each has
100% accepted field area. The UI explicitly labels this changed comparison date.
It does not substitute May ET for June ET. This is one usable ET date, not a season.

## Actual scientific-file contract

The capture retains 117 full scientific GeoTIFFs and 24 source metadata JSON files,
75,982,452 bytes total; 24 product records. The processed package is approximately
730 KB, with an optional explicit offline download. Native tiles are 1568×1568,
EPSG:32615, 70 m pixel spacing. The pilot extraction is an 11×11 window: 121 native
cells. Exact UTM cell/field intersections supply area weights. No interpolation,
resampling or downscaling is performed by this application. Provider tiling itself
resamples swath data; posting is not independent observational resolution/accuracy.

| Layer | Actual encoding | Physical meaning |
|---|---|---|
| LST | float32, NaN fill; scale 1, offset 0 | Kelvin, displayed as °C by subtracting 273.15; instantaneous mixed-surface retrieval |
| LST_err | float32, NaN | Pixel retrieval error, K; not field-average uncertainty |
| QC | uint16, no embedded nodata tag | TES mandatory and L1B data-quality flags; cloud flags are not populated in these QC bits |
| cloud, water | uint8, no embedded nodata tag | Separate masks; only exact zero accepted |
| PTJPLSMinst, PET | float32, NaN | Instantaneous modeled latent heat flux, W/m² |
| ETdaily | float32, NaN | Modeled sunrise-to-sunset integrated ET expressed in mm/day; no measured 24-hour time bounds |
| ETinstUncertainty | float32, NaN | Instantaneous between-model standard deviation, W/m²; not daily uncertainty or total predictive uncertainty |
| ESI | float32, NaN | PT-JPL-SM actual/potential instantaneous ET ratio, 0–1; not a standardized anomaly |

GeoTIFF unit tags are absent. Units are verified against primary producer documentation,
not guessed from magnitudes. The Collection 2 PDF Table 10 incorrectly groups ETdaily
with W/m²; its prose and the producer repository's corrected table specify mm/day.
The producer implementation writes `ET_daily_kg` to ETdaily. The actual retained May
ESI pixels also match clipped PTJPLSMinst/PET within floating-point tolerance.
No Collection 1 or Collection 3 variable definitions are applied to these files.

Primary references, checked 13 November 2026:
- [Collection 2 producer guide](https://github.com/ECOSTRESS-Collection-2/ECOv002-L3T-L4T-JET/blob/main/documentation/ECOSTRESS_User_Guide_V2.md).
- [L2 user guide, 19 August 2024](https://lpdaac.usgs.gov/documents/1574/ECOL2_User_Guide_V2.pdf), especially corrected QA table.
- [Collection 2 grid/tile guide](https://lpdaac.usgs.gov/documents/1655/ECO_L1C-4_Grid_Tile_User_Guide_V2.pdf).
- [NASA/JPL product documentation directory](https://ecostress.jpl.nasa.gov/data/atbds-summary-table).

The producer-guide content hash and explicit screening policy are retained in
`ecostress_product_policy.json`. Actual source metadata identifies builds 0711/0712
and PGE version; each record exports its version and complete source-file hashes.
Native source JSON supplies scene start/end and local civil time is displayed in
America/Chicago. The scene interval is not a full-day observation interval.

## Screening and interpretation limits

Conservative application policy: cloud=0, water=0, QC bits 0–3=0, finite LST_err
between 0 and 2 K, granule AutomaticQualityFlag=PASS and FieldOfViewObstruction=NO.
ET/ESI additionally require these matched L2 screens. Numerical values must be finite
and physically nonnegative (ESI 0–1); NaN remains null. Field summaries require
80% valid intersection area. These thresholds are engineering screening choices,
not locally calibrated probabilities. Raw values, masks and all rejection reasons
are exported. Error/spread layers have no field-mean confidence summary.

LST is not isolated canopy temperature. CWSI is withheld because canopy temperature,
matching meteorology and wet/dry baselines are unavailable. Neither LST nor ESI
alone diagnoses crop water stress, damage, nitrogen status or irrigation need.
Sparse ETdaily dates are never summed into a monthly water budget.

Landsat comparison selects the nearest usable field observation within ±8 days,
reports the signed hour offset, and withholds matching after a boundary edit. This
8-day limit is an exploration policy, not validated fusion. L4 context uses the
three-hour native interval containing the scene start; IMERG uses the complete
UTC day and warns that it includes time before and after the overpass. No regional
May moisture/rain is fabricated from the June archive. Farmer windows match inclusive
UTC dates and their recorded boundary. ECOSTRESS ET uses LST, STARS vegetation and
GEOS inputs, so agreement across sources is not independent or causal validation.

## Reproduction

From repository root, use an environment with earthaccess, python-dotenv, requests,
rasterio, numpy, shapely and pyproj. Credentials stay in ignored `.env`; no shell
sourcing, public credentials or signed download URLs.

```bash
python backend/atlas/ecostress_acquire.py --dates 2024-05-23 2024-06-27 2024-06-28 --all-june
python backend/atlas/ecostress_process.py
python backend/atlas/ecostress_process.py --out /tmp/fieldshift-eco-replay/ecostress
python -m unittest discover -s backend/atlas -p 'test_ecostress.py'
```

Acquisition is sequential, bounded to selected dates, uses actual CMR links and
private full-file caching, and reports sanitized failure stages. Existing receipted
files must match their hashes; corrupt cached files require inspection. Processing
is network-free. API `/api/atlas/ecostress?field=iowa-demo` validates the package and
ETag; other fields return 404. The UI uses the same checked static archive for both
production and standalone offline operation. A small index enters the offline core;
full evidence requires Load / Save offline. Remove deletes the dedicated cache.
Exports include `ecostressEvidence` separately from original weather forcing and
`regionalSeasonalEvidence`. Browser storage eviction remains possible.

Remaining requirements before agronomic use: independent local LST/ET checks,
representative canopy/soil partitioning, field soil-moisture measurements and flux
validation with time/support matching. June ET/ESI remains scientifically unavailable
at this field under current QA. Collection 3 reprocessing can be evaluated later,
without silently replacing this versioned evidence. Broader ET temporal coverage,
diurnal/nighttime accounting, calibrated uncertainty and causal rotation effects
are not established by this integration or software tests.
