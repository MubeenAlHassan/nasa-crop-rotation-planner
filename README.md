# Rotation Atlas

Rotation Atlas helps farmers compare their current crop rotation with other options before committing to a change. It brings historical NASA weather, satellite observations and farm inputs into one workspace, with the assumptions visible alongside the results.

The project was built around the **Field Shift** challenge for NASA Space Apps. This version uses a demonstration field in Iowa and compares four rotations over a shared 2027–2030 planning period:

- The current maize–soybean rotation.
- Maize–soybean with winter rye cover.
- A grain-and-legume rotation with wheat and red clover.
- A forage rotation with oats and alfalfa.

## Using the workspace

**Compare rotations** shows water shortfall, days with a scheduled living crop and gross margin for each option. You can change rainfall, prices, soil-water capacity and farmer priorities to see how the comparison responds. Questions about labor, equipment, buyers and crop suitability remain open until the farmer answers them. Unknown or failed checks limit ranking.

**Field history & windows** puts dated satellite observations alongside local crop and management records. A low vegetation index can prompt a review, but confirming the ground condition requires a local note. A confirmed bare-soil interval can then be compared with the seasonal dates in each rotation's crop calendar.

**Evidence & method** explains the calculations, crop budgets, data sources and quality checks. Reports can be downloaded as JSON, Excel, Word or PDF. Selecting a card lets you inspect it; recording a rotation choice is a separate step.

## What the results mean

The model replays weather from 2013–2024 in three four-year blocks. Every rotation starts each block with the same water, snow and residue conditions. The differences between blocks show how the scenarios behaved under those historical conditions; they do not give probabilities for future outcomes.

NASA POWER supplies the weather used in the simulation. Other evidence is kept separate so its dates, spatial coverage and quality limits remain clear:

| Source | Role in the app |
| --- | --- |
| Landsat | Dated vegetation indicators for reviewing field history |
| SMAP and GPM IMERG | Regional soil-moisture and rainfall context |
| ECOSTRESS | Surface temperature and modeled water-use context on acquired dates |
| GRACE / GRACE-FO | Regional changes in total water storage |
| MODIS and NASADEM | Surrounding vegetation and terrain context |
| USDA SSURGO | Soil-survey properties to discuss alongside local soil tests |

This is a research prototype. Crop calendars, yields, costs and water responses still need local review and calibration. Satellite indices do not establish bare soil or protective residue between observations. The app does not estimate erosion loss, soil-carbon change, pest reduction or the probability that a rotation will outperform the baseline. Farmer usability trials and agronomic validation remain outstanding.

## Run locally

Use **Node.js 22**. From the repository root:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

Open [localhost:3000](http://localhost:3000) for the introduction, or [localhost:3000/atlas](http://localhost:3000/atlas) for the workspace.

The app reads captured evidence included in the repository. It does not need a running Python server or a live NASA API connection. The frontend uses Next.js, React and TypeScript; the same comparison engine runs in the browser and through the Next.js API.

For a production build:

```sh
npm run build --prefix frontend
npm run start --prefix frontend
```

The build runs the tests, generates route types, checks TypeScript and compiles the app. Both development and production build commands also rebuild the offline bundle.

## Offline use

Open the app while connected and let the offline pack finish saving. The core comparison can then run without a connection. Optional seasonal evidence packages have their own **Save offline** controls.

Drafts are stored in the current browser on the current device. Export a report if you need a backup or want to share a decision with an adviser. Clearing browser storage can remove saved drafts and evidence.

To build and serve the standalone version:

```sh
npm run build:atlas --prefix frontend
python3 -m http.server 4174 --directory dist-atlas
```

Open [localhost:4174/atlas/](http://localhost:4174/atlas/). This version calculates in the browser and can be hosted as static files. The full Next.js version also exposes `POST /api/atlas/compare`. Decision saving remains local in both versions.

## Development checks

To run lint and tests separately:

```sh
npm run lint --prefix frontend
npm run test --prefix frontend -- --run
```

With the production app running on port 3000 and Chrome installed, run the main browser check:

```sh
node scripts/atlas-browser-smoke.mjs http://127.0.0.1:3000 --server
```

It checks the comparison workflow, exports, responsive layouts and offline reopening. The [pre-merge audit](docs/PRE_MERGE_AUDIT.md) records the broader test coverage, fixes and remaining limits.

## Data tools and documentation

The optional acquisition and processing scripts are in `backend/atlas/`. Use a separate Python environment for this work. Exact replay of the captured evidence uses Python 3.12 and the versions in `backend/atlas/requirements-evidence.txt`; the native-file tests also need the original captured files in the local provider cache.

- [Implementation guide](docs/ROTATION_ATLAS.md): model details, API behavior and evidence coverage.
- [Model contract](docs/ATLAS_MODEL_CONTRACT.md): comparison rules, units and scoring assumptions.
- [Earthdata setup](backend/atlas/EARTHDATA_SETUP.md): access and capture instructions.
- [Graph audit](docs/GRAPH_PLOTTING_AUDIT.md): checks against source values, dates and quality masks.
- [Pre-merge audit](docs/PRE_MERGE_AUDIT.md): release checks and reproduction commands.

AI assistance was used in development and documentation.
