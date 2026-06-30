import { defineConfig } from 'vitest/config';

/** GitHub Pages project site: https://annacv.github.io/tribute-to-lemmings/ */
const GITHUB_PAGES_BASE = '/tribute-to-lemmings/';

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
