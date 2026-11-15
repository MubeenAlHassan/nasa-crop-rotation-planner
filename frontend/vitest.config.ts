import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Vercel builds inherit NODE_ENV=production. React's production entry omits
  // act(), so test workers must select React's test/development implementation.
  // This applies only to Vitest; the subsequent Next build stays production.
  test: {
    env: { NODE_ENV: 'test' },
    // Large scientific fixtures and full-workspace DOM tests otherwise compete
    // for CPU/memory on high-core CI hosts and can exceed per-test deadlines.
    maxWorkers: 4,
    // This DOM test reads scientific fixtures and uses Node Web Crypto. Keep
    // Node built-ins when Vercel starts Vite under NODE_ENV=production; jsdom
    // still supplies the DOM, independently of the module transform mode.
    testTransformMode: { ssr: ['**/nasa-season-panel.test.tsx'] },
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
});
