# Field Shift — NASA crop rotation planner

Use Python 3.11.13 and Node 22. Install the committed dependencies from the repository root:

```sh
uv sync --frozen --extra dev
npm ci --prefix frontend
```

The production FastAPI entrypoint is **`app.main:app`**, loaded from `backend/`:

```sh
.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm run dev --prefix frontend
```

For the original historical Faisalabad demonstration, start that same production application with explicit fixture enablement:

```sh
ENABLE_DEMO_FIXTURES=true BACKEND_DATA_DIR="$PWD" \
  .venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open `/planner` and select **Rainfed demo** or **Irrigated demo (wheat)**. The landing-page demo link (`/planner?demo=1`) explicitly selects the rainfed demo. Choosing Faisalabad coordinates alone does not authorize fixture mode. A failed custom request keeps its farm and form inputs; **Retry same request** repeats those inputs, and **Run Faisalabad demo instead** explicitly switches to the demonstration farm and applies its defaults.

The browser uses the Next.js same-origin `/api/recommend-rotation` BFF, which forwards to `/api/v1/recommend-rotation`. Its default backend is `http://127.0.0.1:8000`; deployment configuration uses server-only `BACKEND_BASE_URL` and the matching `BACKEND_ALLOWED_UPSTREAM_ORIGINS` allowlist.

`backend/main.py` is legacy fixture scaffolding. `app.mock_server:app` is a synthetic contract-test server. Neither is the production demonstration entrypoint.

The original fixture `faisalabad_2025` remains pinned: rainfed returns zero feasible rotations; irrigation available returns one wheat rotation with score **43.5**. POWER is recorded historical data; SoilGrids and SMAP remain unavailable. See [the judge script](agent_docs/JUDGE_DEMO.md) for provenance and limitations.

Verification from the repository root:

```sh
PYTHONPATH=backend .venv/bin/python -m pytest -q
.venv/bin/python backend/scripts/verify_phase0.py
npm run test --prefix frontend -- --run
npm run lint --prefix frontend
npm run build --prefix frontend
```

The frontend build runs tests, Next.js type generation, TypeScript validation, and the production build. It downloads the configured Google fonts when they are not already cached.
