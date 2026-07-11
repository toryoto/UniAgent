import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest 設定。tsconfig の `@/*` エイリアスをテストでも解決する。
 * `@/lib/db/*` を import するオーケストレータを DB モックで通しテストする。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
