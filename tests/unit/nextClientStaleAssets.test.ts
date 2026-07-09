import { describe, expect, it } from 'vitest'
import {
  isNextClientStaleAssetError,
  isNextStaticAssetUrl,
} from '@/lib/next-client-stale-assets'

describe('next client stale assets', () => {
  it('matches Next static asset URLs', () => {
    expect(isNextStaticAssetUrl('/_next/static/chunks/app.js')).toBe(true)
    expect(isNextStaticAssetUrl('https://cdn.example/_next/static/css/app.css')).toBe(true)
    expect(isNextStaticAssetUrl('/images/logo.png')).toBe(false)
  })

  it('matches Turbopack missing module errors', () => {
    expect(isNextClientStaleAssetError(new Error(
      'Module 948971 was instantiated because it was required from module 589170, but the module factory is not available.',
    ))).toBe(true)
  })

  it('matches chunk load errors', () => {
    expect(isNextClientStaleAssetError(new Error('ChunkLoadError: Loading chunk 123 failed.'))).toBe(true)
  })

  it('ignores ordinary app errors', () => {
    expect(isNextClientStaleAssetError(new Error('Internal server error'))).toBe(false)
  })
})
