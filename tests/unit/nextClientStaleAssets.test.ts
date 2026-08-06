import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isNextClientStaleAssetError,
  isNextStaticAssetUrl,
  requestNextClientStaleAssetReload,
} from '@/lib/next-client-stale-assets'

function createMemoryStorage() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  }
}

describe('next client stale assets', () => {
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')

  afterEach(() => {
    if (sessionStorageDescriptor) {
      Object.defineProperty(window, 'sessionStorage', sessionStorageDescriptor)
    }
  })

  it('matches Next static asset URLs', () => {
    expect(isNextStaticAssetUrl('/_next/static/chunks/app.js')).toBe(true)
    expect(isNextStaticAssetUrl('https://cdn.example/_next/static/css/app.css')).toBe(true)
    expect(isNextStaticAssetUrl('/images/logo.png')).toBe(false)
  })

  it('matches Turbopack missing module errors', () => {
    expect(
      isNextClientStaleAssetError(
        new Error(
          'Module 948971 was instantiated because it was required from module 589170, but the module factory is not available.',
        ),
      ),
    ).toBe(true)
  })

  it('matches chunk load errors', () => {
    expect(isNextClientStaleAssetError(new Error('ChunkLoadError: Loading chunk 123 failed.'))).toBe(true)
    expect(
      isNextClientStaleAssetError(
        new Error('Failed to load chunk /_next/static/chunks/1ju5vlxvx10c7.js?dpl=dee1b68 from module 442555'),
      ),
    ).toBe(true)
  })

  it('ignores ordinary app errors', () => {
    expect(isNextClientStaleAssetError(new Error('Internal server error'))).toBe(false)
  })

  it('reloads only once for the same deployment', () => {
    const reload = vi.fn()
    const storage = createMemoryStorage()

    expect(requestNextClientStaleAssetReload({ deploymentId: 'deploy-a', reload, storage })).toBe(true)
    expect(requestNextClientStaleAssetReload({ deploymentId: 'deploy-a', reload, storage })).toBe(false)
    expect(requestNextClientStaleAssetReload({ deploymentId: 'deploy-b', reload, storage })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('falls back to memory when session storage is unavailable', () => {
    const reload = vi.fn()

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError')
      },
    })

    expect(requestNextClientStaleAssetReload({ deploymentId: 'storage-blocked', reload })).toBe(true)
    expect(requestNextClientStaleAssetReload({ deploymentId: 'storage-blocked', reload })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('falls back to memory when writing to storage fails', () => {
    const reload = vi.fn()
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      },
    }

    expect(requestNextClientStaleAssetReload({ deploymentId: 'storage-full', reload, storage })).toBe(true)
    expect(requestNextClientStaleAssetReload({ deploymentId: 'storage-full', reload, storage })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
