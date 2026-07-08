import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isNextStaticAssetUrl,
  isStaleNextClientAssetError,
  requestStaleNextClientAssetReload,
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
    expect(isStaleNextClientAssetError(new Error(
      'Module 948971 was instantiated because it was required from module 589170, but the module factory is not available.',
    ))).toBe(true)
  })

  it('matches chunk load errors', () => {
    expect(isStaleNextClientAssetError(new Error('ChunkLoadError: Loading chunk 123 failed.'))).toBe(true)
  })

  it('ignores ordinary app errors', () => {
    expect(isStaleNextClientAssetError(new Error('Internal server error'))).toBe(false)
  })

  it('reloads once per build and path', () => {
    const reload = vi.fn()
    const storage = createMemoryStorage()
    const location = { pathname: '/portfolio', search: '' }

    expect(requestStaleNextClientAssetReload({
      buildId: 'build-a',
      location,
      reload,
      storage,
    })).toBe(true)
    expect(requestStaleNextClientAssetReload({
      buildId: 'build-a',
      location,
      reload,
      storage,
    })).toBe(false)
    expect(requestStaleNextClientAssetReload({
      buildId: 'build-b',
      location,
      reload,
      storage,
    })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('falls back when session storage access throws', () => {
    const reload = vi.fn()
    const location = { pathname: '/portfolio', search: '' }

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError')
      },
    })

    expect(requestStaleNextClientAssetReload({
      buildId: 'storage-blocked',
      location,
      reload,
    })).toBe(true)
    expect(requestStaleNextClientAssetReload({
      buildId: 'storage-blocked',
      location,
      reload,
    })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
