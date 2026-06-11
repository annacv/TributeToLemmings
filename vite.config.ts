import { defineConfig } from 'vitest/config';

/** GitHub Pages project site: https://annacv.github.io/TributeToLemmings/ */
const GITHUB_PAGES_BASE = '/TributeToLemmings/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  build: {
    assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./assets/ts/test-setup.ts'],
  },
}));
