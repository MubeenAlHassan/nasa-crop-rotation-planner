# NASA access — updated 2026-11-12

**Current:** SMAP L3/L4 and IMERG authenticated acquisition now succeeds. Earlier
credential/EULA failures below are historical. See the final section for commands.


No Earthdata username/password environment pair, token, or `urs.earthdata.nasa.gov`
netrc entry was present. Public CMR metadata is accessible; catalog discovery is
**not** authenticated granule acquisition or QA. No missing mission supplies
numeric observations in the application. The public ORNL MODIS route is independent.

`access_preflight.py` checked the following identifiers against primary CMR
collection responses (retained under `frontend/public/atlas/evidence-raw/access-*`).
The report is `frontend/public/atlas/access-status.json`.

| Dependency order | Short name | Exact CMR version | Next activation gate |
|---|---|---|---|
| 1. Surface moisture | SPL3SMP_E | 006 | Authenticated native granule; retrieval QA, freeze/snow/water flags, fill and m³/m³ metadata |
| 1. Root-zone context | SPL4SMGP | 008 | Authenticated model-assimilation granule; 3-hour time support, 0–5/0–100 cm definitions, model diagnostic/uncertainty fields |
| 2. Rainfall context | GPM_3IMERGHH | 07 | V07 half-hourly file; precipitation rate units, duration integration, uncertainty/quality, gauge calibration and all missing intervals |
| 3. Thermal context | ECO_L2T_LSTE | 003 | C3 representative LST/error/cloud/water/QA schema and UTC/local overpass time |
| 3. ET/ESI | ECO_L3T_JET / ECO_L4T_ESI | 003 | Actual C3 product-specific units, masks, definitions and applicable meteorological support |
| 4. Regional storage | TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4 | RL06.3Mv04 | NetCDF units/reference baseline/time bounds, uncertainty, mascon support and valid regional aggregation |

The proposed GRACE version string `RL06.3_V4` returned **zero** CMR matches.
Short-name discovery revealed the actual catalog version `RL06.3Mv04`; the
preflight and raw-capture helper now use it. Failed-query metadata is retained
as an audit trail. The collection identifier itself was correct.

## Operator setup (outside the website)

1. Create or use a free [NASA Earthdata Login](https://urs.earthdata.nasa.gov/)
   account. Review/authorize the DAAC application requested by the data service,
   including GES DISC for IMERG. See NASA's
   [download authentication instructions](https://urs.earthdata.nasa.gov/documentation/for_users/data_access/curl_and_wget).
2. Configure your account using the existing `earthaccess` environment or netrc
   authentication mechanism, on the acquisition machine only. A private
   `~/.netrc` entry has the syntax below; replace placeholders locally, set file
   permissions to `0600`, and never put it in this repository or a report:

   ```text
   machine urs.earthdata.nasa.gov
     login YOUR_EARTHDATA_USERNAME
     password YOUR_EARTHDATA_PASSWORD
   ```

   Alternatively configure `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` in your
   local secret manager/environment. Do not paste credentials into chat or the UI.
   No Earthdata secret belongs in `NEXT_PUBLIC_*`, public assets, or browser storage.
3. Install the optional `backend/atlas/requirements-geospatial.txt` in an isolated
   environment, then run the existing raw-capture helper with a small initial limit:

   ```sh
   python backend/atlas/earthdata_capture.py --product smap --start 2024-06-01 --end 2024-06-02 --limit 1 --out /tmp/fieldshift-smap
   python backend/atlas/earthdata_capture.py --product smap-rootzone --start 2024-06-01 --end 2024-06-02 --limit 1 --out /tmp/fieldshift-smap-l4
   python backend/atlas/earthdata_capture.py --product imerg --start 2024-06-01 --end 2024-06-02 --limit 1 --out /tmp/fieldshift-imerg
   python backend/atlas/earthdata_capture.py --product ecostress --start 2024-06-01 --end 2024-07-01 --limit 1 --out /tmp/fieldshift-ecostress
   ```

   Additional helper keys are `ecostress-et`, `ecostress-esi` and `grace`.
   Raw downloads can be large. A no-granule response is coverage missingness,
   not a reason to substitute another version or fabricate observations.
4. Inspect the representative file and source documentation before implementing
   each adapter. Match native coordinates, quality and observation intervals;
   retain source hashes. The generic experimental helpers in `harmonize.py` do
   **not** activate these products. Only after scientific contracts and QA pass
   should an adapter connect processed values to the evidence API/UI/offline pack.

## Scientific qualifications and primary references

- [SMAP L4 V8 user guide](https://nsidc.org/sites/default/files/documents/user-guide/multi_spl4smau-v008-userguide.pdf): surface 0–5 cm and root-zone 0–100 cm are vertical averages from land-model assimilation. The 9 km grid does not make independent farm observations. The NSIDC page also reports a May–July 2026 geolocation issue; a 2024 pilot avoids that interval, but future captures must check replacement/reprocessing status.
- [IMERG mission documentation](https://gpm.nasa.gov/data/imerg): do not relabel POWER rainfall or the public V06 mirror as V07 IMERG. Half-hourly rates need interval completeness before accumulation.
- [ECOSTRESS instruments/products](https://www.earthdata.nasa.gov/data/instruments/ecostress): LST alone cannot diagnose water stress; ESI requires its specific product definition, not an invented universal scale.
- [JPL GRACE RL06.3 V4](https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4): monthly regional TWS is not field moisture or direct groundwater. Additional storage components and correlated uncertainties are needed for groundwater inference.
- [CMR API documentation](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html): exact collection metadata and access links are retained; no invented endpoint or band is enabled.

All checks above are access/schema readiness checks, not agronomic validation.


## Actual representative-download attempt — 12 November 2026

Credential resolution still found no environment username/password pair, token,
or Earthdata netrc entry. `verify_access.py` looked up one June 2024 granule for
each selected collection and made a bounded unauthenticated byte-range request
to its actual HTTPS download link. **All three returned HTTP 401**:

- SPL3SMP_E.006: `SMAP_L3_SM_P_E_20240601_R19240_001.h5`.
- SPL4SMGP.008: `SMAP_L4_SM_gph_20240531T223000_Vv8012_001.h5`
  (catalog interval overlaps the requested June 1 period).
- GPM_3IMERGHH.07: `3B-HHR.MS.MRG.3IMERG.20240601-S000000-E002959.0000.V07B.HDF5`.

These are catalog/file-name identities, **not verified scientific file schemas**.
No scientific bytes or authenticated granule were acquired. Dimensions, variables,
packing, quality, uncertainties and interval-bound conventions therefore remain
unverified against actual files. No numerical SMAP/IMERG adapter was enabled.
The safe report is `frontend/public/atlas/access-attempt.json`; it is linked in
the evidence UI and included in combined-export provenance. It contains no
credential value, authorization header, response body or signed URL.

Required operator action: configure Earthdata Login credentials on the acquisition
machine using the setup above, authorize the DAAC access application (including
GES DISC), install the optional isolated capture dependencies, and retry a single
granule. Do not put credentials in chat or browser settings. The unauthenticated
probe refuses to run when credentials are configured; use `earthdata_capture.py`
for the authenticated step. A 401 without credentials does not establish that any
particular account is invalid or unauthorized.

Primary product pages rechecked on 2026-11-12:
[SMAP surface V6](https://nsidc.org/data/spl3smp_e/versions/6),
[SMAP L4 V8](https://nsidc.org/data/spl4smgp/versions/8), and
[NASA IMERG](https://gpm.nasa.gov/data/imerg). L4 remains assimilation context,
not a root-zone field measurement. IMERG accumulation must wait for actual V07
rate units/time intervals/QA verification; absent intervals must stay missing.

## Focused authentication diagnosis — 12 November 2026 (follow-up)

Checked the supported earthaccess mechanisms without printing values: environment
username/password, `EARTHDATA_TOKEN`, home `.netrc`, and the `NETRC` override.
All are absent. `EARTHDATA_ACCESS_TOKEN` is also absent, but is **not** the documented
earthaccess token variable; use `EARTHDATA_TOKEN`. No local `.env` file was found;
this capture helper does not load dotenv files automatically. System Python does
not currently have earthaccess installed.

Fresh full scientific-file GET attempts (not catalog discovery) reached both
providers after retrying outside the network-restricted sandbox:

| Product / date | Redirect | Terminal response |
|---|---|---|
| SPL3SMP_E.006 / 2024-06-01 | NSIDC data host → Earthdata Login, HTTP 302 | HTTP 401 at `urs.earthdata.nasa.gov` |
| GPM_3IMERGHH.07 V07B / 2024-06-01 00:00 | GES DISC data host → Earthdata Login, HTTP 302 | HTTP 401 at `urs.earthdata.nasa.gov` |

No scientific file was acquired. Credential resolution is the actionable blocker.
Redirects reached Login successfully: there was no observed redirect loop or
provider transport failure in the network-enabled retry. Invalid account credentials
and missing provider authorization remain **untested**, not diagnosed from these
401s. Sanitized result: `artifacts/earthdata-auth-diagnosis.json` (hostnames/statuses
only; no redirect query strings, response bodies or credentials).

### Exact local fix and verification

Run these commands yourself in a local terminal on the acquisition machine, from
the repository root. Interactive login keeps the password out of shell history;
the resulting netrc is private to your OS account, outside this repository.

```sh
python3 -m venv /tmp/fieldshift-earthdata-env
/tmp/fieldshift-earthdata-env/bin/pip install -r backend/atlas/requirements-geospatial.txt
/tmp/fieldshift-earthdata-env/bin/python -c 'import earthaccess; a=earthaccess.login(strategy="interactive", persist=True); print("authenticated:", a.authenticated)'
chmod 600 ~/.netrc
```

If using a custom `NETRC` path, apply permissions to that private file instead.
Alternatively inject the documented environment variables from your secret manager
into the acquisition process; variables set in another terminal do not automatically
appear in an already-running Codex process.

In [Earthdata Login](https://urs.earthdata.nasa.gov/), select **Applications →
Authorized Apps → APPROVE MORE APPLICATIONS**. Search `GESDISC`, authorize
**NASA GESDISC DATA ARCHIVE**, and complete any requested agreements/profile fields.
For NSIDC, open the representative granule link from the existing safe
`frontend/public/atlas/access-attempt.json` in your signed-in browser and authorize
the application requested by that service. Do not guess an application identity
from the HTTP status alone. NASA documents the
[authorization steps](https://urs.earthdata.nasa.gov/documentation/for_users/how_to_preauth_app)
and [GESDISC download requirements](https://urs.earthdata.nasa.gov/documentation/for_users/data_access/curl_and_wget).
Supported credential mechanisms are documented by
[earthaccess](https://earthaccess.readthedocs.io/en/stable/user/howto/authenticate/)
(references checked 2026-11-12).

Verify **both** providers, not only login:

```sh
/tmp/fieldshift-earthdata-env/bin/python backend/atlas/earthdata_capture.py --product smap --start 2024-06-01 --end 2024-06-02 --limit 1 --out /tmp/fieldshift-smap
/tmp/fieldshift-earthdata-env/bin/python backend/atlas/earthdata_capture.py --product imerg --start 2024-06-01 --end 2024-06-02 --limit 1 --out /tmp/fieldshift-imerg
```

Success requires actual nonempty scientific files and matching manifest checksums,
then successful HDF5 decoding; `authenticated: True` or a catalog match alone is
insufficient. If login fails with configured credentials, resolve account/password
or token validity first. If login succeeds but a provider refuses downloads, check
its application authorization and retained session before diagnosing the account
as invalid. Report only exception type, HTTP status, stage and host; never paste
raw response bodies, authorization headers, tokens or signed redirect URLs.
Scientific schema inspection and integration remain stopped until this gate passes.

## Latest: `.env` works for SMAP; IMERG requires EULA acceptance

On 2026-11-12 the root `.env` was explicitly loaded using python-dotenv with
interpolation disabled. Credential values were never printed, exported into public
assets or committed. The file and provider cache are Git-ignored. Installed
`earthaccess 0.19.0`, `python-dotenv 1.2.4`, and `h5py 3.16.0` only in the existing
`/tmp/fieldshift-evidence-env` temporary environment.

**Successful:** full authenticated SPL3SMP_E.006 file for June 1, 2024, 690,081,639
bytes; checksum and actual HDF5 metadata inspected. Raw file retained under
`backend/.provider_cache/earthdata/`. The pilot AM/PM retrieval flags are uncertain,
so no numerical moisture evidence is enabled. Missing error estimates remain null.

**Blocked:** authenticated GPM_3IMERGHH.07 V07B scientific-file GET returns HTTP 403
from `data.gesdisc.earthdata.nasa.gov`; sanitized error description is
**EULA Acceptance Failure**, with `urs.earthdata.nasa.gov` as resolution host.
This is the precise provider-agreement failure, distinct from previous unauthenticated
401s. No IMERG HDF5 file was acquired or decoded.

### Required operator action

1. Sign in to [Earthdata Login](https://urs.earthdata.nasa.gov/) with the account
   used by the configured credentials/token.
2. Open **Applications → Authorized Apps**. Locate the GES DISC application. If
   absent, use **APPROVE MORE APPLICATIONS**, search `GESDISC`, and select
   **NASA GESDISC DATA ARCHIVE**. Complete the agreement/profile prompts and choose
   **AUTHORIZE**. If already listed, open the representative IMERG `sourceUrl` from
   `frontend/public/atlas/access-attempt.json` in that signed-in browser and follow
   the service's agreement prompt. Merely logging in is insufficient.
3. Retry the IMERG capture with `.env` explicitly loaded. The existing capture helper
   does not load dotenv automatically. From the repository root:

   ```sh
   /tmp/fieldshift-evidence-env/bin/python -c 'from dotenv import load_dotenv; import runpy, sys; load_dotenv(".env", override=True, interpolate=False); sys.argv=["earthdata_capture.py", "--product", "imerg", "--start", "2024-06-01", "--end", "2024-06-02", "--limit", "1", "--out", "/tmp/fieldshift-imerg"]; runpy.run_path("backend/atlas/earthdata_capture.py", run_name="__main__")'
   ```

   Keep any local diagnostic output private; do not paste raw tracebacks or tokens.
   Success means a nonempty HDF5 file plus matching manifest checksum, followed by
   schema inspection. If the same EULA error persists after acceptance, contact
   GES DISC support with the product/granule identifier and sanitized error (no
   credentials). Do not replace the error with zero rainfall or an older product.

NASA documents the agreement/authorization UI in its
[application authorization instructions](https://urs.earthdata.nasa.gov/documentation/for_users/how_to_preauth_app).
SMAP QA interpretation was checked against the
[NSIDC flag guidance](https://nsidc.org/data/user-resources/help-center/how-do-i-interpret-surface-and-quality-flag-information-level-2-and-3-passive-soil-moisture-products)
and actual V006 file attributes. References checked 2026-11-12. This is access and
representative-file verification, not calibration or agronomic validation.

## Resolved: authenticated acquisition and native evidence integration

The user accepted the GES DISC agreement. IMERG returned HTTP 200 and a complete
V07B HDF5 file; the pilot expanded to all 48 intervals for June 1, 2024. SMAP L3 V006
and L4 V008 GPH were also downloaded and inspected. No current access blocker for
these selected products. This historical checkpoint predates the now-completed
ECOSTRESS and GRACE acquisitions; see ECOSTRESS_EVIDENCE.md and GRACE_EVIDENCE.md.

Reproducible bounded commands, from the repository root:

```sh
/tmp/fieldshift-evidence-env/bin/python backend/atlas/acquire_nasa_pilot.py --product smap
/tmp/fieldshift-evidence-env/bin/python backend/atlas/acquire_nasa_pilot.py --product smap-rootzone
/tmp/fieldshift-evidence-env/bin/python backend/atlas/acquire_nasa_pilot.py --product imerg
/tmp/fieldshift-evidence-env/bin/python backend/atlas/nasa_context.py
/tmp/fieldshift-evidence-env/bin/python -m unittest discover -s backend/atlas -p 'test_nasa_context.py'
```

The acquisition helper explicitly loads `.env` and suppresses library logs. Failures
report only stage, exception type and status; it never persists cookies, token values
or signed redirect URLs. Cached native files are reused. The processor is network-free;
use `--out /tmp/fieldshift-nasa-replay` to reproduce the 51 public package/subset outputs.
For a fresh environment install `requirements-geospatial.txt` first. This is pinned
pilot capture, not yet an arbitrary-date acquisition service.

See IMPLEMENTATION_PLAN.md for exact counts and withheld QA. L4 GPH is three-hour
model assimilation with 0–5/0–100 cm depths; its raw J2000 time is retained, but
explicit file UTC extent metadata controls the displayed interval. AUP uncertainty
is not fabricated. The L4 precipitation-forcing metadata references IMERG, so the
products cannot be treated as independent confirmation. No model forcing or score
changes were made.

## Seasonal native subsets — verified June delivery (13 November 2026)

Use an environment containing `earthaccess`, `python-dotenv`, `requests`, `h5py`
and `numpy` (requirements-geospatial.txt). Acquisition loads root `.env` explicitly
with interpolation disabled. Do not shell-source credentials. Run from repository root:

```bash
python backend/atlas/nasa_season_acquire.py --start 2024-06-01 --end 2024-06-30
python backend/atlas/nasa_season_process.py --start 2024-06-01 --end 2024-06-30
```

The first command queries actual CMR OPeNDAP links and requests native array indices;
URLs are not synthesized. It resumes by validating constraint and subset SHA-256,
uses at most two workers, pauses between requests, retries three times and honors
numeric Retry-After. `.part` files are not treated as scientific acquisitions. Native
files and receipts remain under ignored `backend/.provider_cache/nasa-season/`.
The second command performs no network access and checks all retained subset hashes,
units, coordinates, flags and bounds. Process **one calendar month at a time**.
It writes `/atlas/nasa-season/YYYY-MM.json` and updates the small month index.
Rebuild the app after processing to update the offline core index.

To resume broader coverage, repeat these commands for each missing calendar month
from March–May and July–November 2024, using its actual final date. Review each month
before exposing the next. `--products imerg` (or smap/rootZone/diagnostics) resumes one
source; `--limit 1` inspects one representative; `--workers 1` lowers load. Do not use
`--limit` as evidence of complete coverage. Receipts preserve catalog extent, source
identifier, processing filename, units via extracted schema, unsigned source URLs,
subset constraint, time acquired, byte count and subset hash. A subset hash is **not**
a hash of the original global granule.

June native subsets total 104.7 MB; public derived JSON is 3.37 MB. Measured rate
suggests roughly six hours / 960 MB for all March–November at two workers. Remaining
months have not been acquired. Monthly public assets load only on explicit request;
Save season offline / Remove offline season controls a separate checksummed browser
cache. The compact index is included in the existing offline shell. Loaded seasonal
data are exported separately as `regionalSeasonalEvidence`, leaving model forcing
and scores unchanged. API: `/api/atlas/nasa-season` lists months;
`/api/atlas/nasa-season?month=2024-06` returns verified data and ETag (404 unacquired).

L4 AUP snapshot ensemble SD is a research diagnostic, not total uncertainty or a
confidence interval. See the [SMAP L4 V008 product specification](https://ntrs.nasa.gov/api/citations/20250006429/downloads/SMAP_L4_SM_PSD_v1-7_for_L4SM_Version_8.pdf)
and [IMERG V07 technical documentation](https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation)
(checked 12 November 2026). No QA relaxation or local field accuracy is claimed.

## Current additional integrations — 13 November 2026

Authenticated ECOSTRESS Collection 002 and JPL CRI GRACE RL06.3Mv04 acquisitions
are complete. Reproduction and coverage: [ECOSTRESS](ECOSTRESS_EVIDENCE.md),
[GRACE](GRACE_EVIDENCE.md). Earlier absent-credential/authorization failures below
are historical diagnostics, not current blockers for these captured products.
