import '@testing-library/jest-dom/vitest'
import './vitest.setup'
import { vi } from 'vitest'

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>()

  return {
    ...actual,
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
  }
})

const jsdomWindow = window as typeof window & {
  jsdom?: { virtualConsole: { removeAllListeners(): void } }
}

jsdomWindow.jsdom?.virtualConsole.removeAllListeners()

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = MockResizeObserver as typeof ResizeObserver
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
