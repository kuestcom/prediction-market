import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/*.test.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/empty-module.ts'),
    },
  },
})
