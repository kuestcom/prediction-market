import { describe, expect, it } from 'vitest'
import runtimeConfig from '../../scripts/runtime-config.js'

const { normalizeBaseUrl, resolveSiteUrl: resolveSchedulerSiteUrl, resolveSchedulerTarget } = runtimeConfig as {
  normalizeBaseUrl: (value: string) => string
  resolveSiteUrl: (env?: Record<string, string | undefined>) => string | null
  resolveSchedulerTarget: (pathname: string, env?: Record<string, string | undefined>) => string | null
}

describe('runtime URL resolution', () => {
  it('uses SITE_URL when provided', () => {
    expect(resolveSchedulerSiteUrl({
      SITE_URL: 'https://app.example.com',
    })).toBe('https://app.example.com')
  })

  it('normalizes SITE_URL without protocol', () => {
    expect(resolveSchedulerSiteUrl({
      SITE_URL: 'preview-kuest.example.com',
    })).toBe('https://preview-kuest.example.com')
  })

  it('supports local host values without forcing https', () => {
    expect(normalizeBaseUrl('localhost:4000')).toBe('http://localhost:4000')
  })

  it('falls back to Vercel URL when SITE_URL is absent', () => {
    expect(resolveSchedulerSiteUrl({
      VERCEL_URL: 'preview-kuest.vercel.app',
    })).toBe('https://preview-kuest.vercel.app')
  })
})

describe('scheduler target resolution', () => {
  it('resolves scheduler base URL from SITE_URL', () => {
    expect(resolveSchedulerSiteUrl({
      SITE_URL: 'https://scheduler.example.com',
    })).toBe('https://scheduler.example.com')
  })

  it('keeps base path when generating sync endpoint targets', () => {
    expect(resolveSchedulerTarget('/api/sync/events', {
      SITE_URL: 'https://example.com/platform',
    })).toBe('https://example.com/platform/api/sync/events')
  })

  it('returns null when no scheduler base URL can be resolved', () => {
    expect(resolveSchedulerTarget('/api/sync/events', {})).toBeNull()
  })
})
