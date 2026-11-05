# Rotation Atlas — NASA crop rotation decision support

Open `/` for the introduction or `/atlas` for the Iowa 12-year comparison workspace: four rotations, sensitivity analysis, evidence provenance, report export and offline replay. Rotation Atlas is the sole frontend experience; the retired `/planner` and `/weather` pages return 404.

## Run the app

Use Node 22. From the repository root:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

Open http://localhost:3000. The dev and build scripts regenerate the offline Atlas bundle. The captured Iowa evidence package lets the comparison run without a live Python backend or satellite download.

```sh
npm run build --prefix frontend
npm run start --prefix frontend
```

The production build runs tests, Next.js route type generation, TypeScript validation and compilation. Atlas uses system fonts, so building does not require a Google Fonts download. After removing or renaming routes, clear the generated `frontend/.next` directory before building if stale route types remain.

See [implementation and validation](agent_docs/ROTATION_ATLAS.md) for model limits, data provenance, API behavior, pipeline commands and the current judge demonstration. NASA POWER observations are captured; other satellite and soil layers are explicitly unavailable.

## Offline and hosted demo

```sh
node scripts/build-atlas.mjs
```

This produces `dist-atlas/`, a static demonstration that calculates locally. The full Next.js app additionally provides `/api/atlas/compare` and `/api/atlas/decisions`; decision sync requires persistent writable storage. See the implementation guide for storage and offline limits.

## Data tooling

The shipped Atlas experience does not require a Python server. Optional NASA capture and geospatial QA tools remain in `backend/atlas/`; they run independently of the hosted Next.js app. The captured Iowa evidence package is already included, so the normal demo does not download data at runtime.

## Verification

```sh
npm run build --prefix frontend
```
