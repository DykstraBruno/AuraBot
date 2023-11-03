import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/tests/**',
        'src/**/*.d.ts',
        'prisma/**',
      ],
      // thresholds desabilitados no CI — rodar localmente para verificar cobertura
      // thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
    testTimeout: 15000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
