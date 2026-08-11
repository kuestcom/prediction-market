import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    silent: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/*.test.{ts,tsx}'],
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'server-only': path.resolve(import.meta.dirname, './tests/empty-module.ts'),
    },
  },
})
