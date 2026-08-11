import path from 'node:path'
import { defineConfig } from 'vitest/config'

const domTestFiles = [
  'tests/unit/**/*.test.tsx',
  'tests/unit/AppKitProvider.test.ts',
  'tests/unit/adminEventsHideCryptoPreference.test.ts',
  'tests/unit/authClient.test.ts',
  'tests/unit/customJavascriptCode.test.ts',
  'tests/unit/eventTrades.test.ts',
  'tests/unit/sideCardImageClient.test.ts',
  'tests/unit/theme.test.ts',
  'tests/unit/themeSettingsSocialLinks.test.ts',
  'tests/unit/useNotifications.test.ts',
  'tests/unit/useSearch.test.ts',
  'tests/unit/utilsConfetti.test.ts',
  'tests/unit/viemNetwork.test.ts',
  'tests/unit/websocketReconnect.test.ts',
]

export default defineConfig({
  test: {
    expect: {
      requireAssertions: true,
    },
    silent: true,
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'server-only': path.resolve(import.meta.dirname, './tests/empty-module.ts'),
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['tests/unit/**/*.test.ts'],
          exclude: domTestFiles.slice(1),
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.dom.ts'],
          include: domTestFiles,
        },
      },
    ],
  },
})
