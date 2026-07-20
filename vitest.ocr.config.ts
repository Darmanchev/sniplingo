import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/integration/ocr.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
