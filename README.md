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

## Retained backend and utilities

The FastAPI service, v1 recommendation contracts, validated TypeScript API client and weather utilities are retained independently of the retired UI. Contract schema identifiers remain unchanged for compatibility. Atlas does not call the regional recommendation API.

Use Python 3.11.13 for the backend:

```sh
uv sync --frozen --extra dev
.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The retained Next.js `/api/recommend-rotation` proxy forwards to `/api/v1/recommend-rotation`. Its default backend is `http://127.0.0.1:8000`; deployments use server-only `BACKEND_BASE_URL` and `BACKEND_ALLOWED_UPSTREAM_ORIGINS`.

The historical Faisalabad fixtures and backend checks remain available. [The archived regional demo script](agent_docs/JUDGE_DEMO.md) documents that earlier work; its UI instructions no longer describe the app. Other regional planning documents are retained as technical history.

## Verification

```sh
PYTHONPATH=backend .venv/bin/python -m pytest -q
.venv/bin/python backend/scripts/verify_phase0.py
npm run build --prefix frontend
# With the production app running on port 4173 and Chrome installed:
node scripts/atlas-browser-smoke.mjs http://127.0.0.1:4173 --server
```
