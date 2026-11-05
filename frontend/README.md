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

See the [project README](../README.md) and [Atlas implementation guide](../agent_docs/ROTATION_ATLAS.md) for evidence capture, static packaging, storage and verification.
