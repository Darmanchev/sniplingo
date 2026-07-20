import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/components/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['services/**/*.ts', 'types/**/*.ts', 'components/**/*.ts'],
    },
  },
});
