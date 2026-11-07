import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Vercel builds inherit NODE_ENV=production. React's production entry omits
  // act(), so test workers must select React's test/development implementation.
  // This applies only to Vitest; the subsequent Next build stays production.
  test: { env: { NODE_ENV: 'test' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
});
