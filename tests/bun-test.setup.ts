import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, expect, mock } from 'bun:test'

if (process.env.BUN_TEST_VERBOSE !== '1') {
  for (const method of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    console[method] = () => {}
  }
}

GlobalRegistrator.register({ url: 'http://localhost:3000' })

const matchers = await import('@testing-library/jest-dom/matchers')
const { cleanup } = await import('@testing-library/react')
const actualNextIntl = await import('next-intl')

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0])

void mock.module('server-only', () => ({}))

void mock.module('next/root-params', () => ({
  locale: mock(async () => 'en'),
}))

void mock.module('next-intl', () => ({
  ...actualNextIntl,
  useExtracted: () => (message: string | { message: string }, values?: Record<string, unknown>) => {
    const text = typeof message === 'string' ? message : message.message

    return values
      ? text.replace(/\{(\w+)\}/g, (_, key: string) => {
          const value = values[key]
          return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : '{' + key + '}'
        })
      : text
  },
}))

if (!process.env.REOWN_APPKIT_PROJECT_ID) {
  process.env.REOWN_APPKIT_PROJECT_ID = 'test-appkit'
}

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://supabase.test'
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

if (typeof window.localStorage?.clear !== 'function') {
  const storage = createMemoryStorage()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})
