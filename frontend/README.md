# Rotation Atlas frontend

Next.js hosts the Rotation Atlas landing page at `/`, the Iowa workspace at `/atlas`, and comparison and decision-sync APIs. The legacy planner and weather screens have been removed.

Use Node 22. From this directory:

```sh
npm ci
npm run dev
npm run build
npm run start
```

Both dev and build regenerate the cached offline bundle. Build also runs the remaining tests and TypeScript checks. Open http://localhost:3000.

The reusable `src/lib/weather` utilities, validated `src/lib/api/client.ts`, generated v1 contracts and `/api/recommend-rotation` proxy are retained for backend compatibility. They are independent of the Atlas UI.

See the [project README](../README.md) and [Atlas implementation guide](../agent_docs/ROTATION_ATLAS.md) for evidence capture, static packaging, persistent storage and verification.
