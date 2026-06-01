import { afterEach, describe, expect, it, vi } from 'vitest'

describe('static params helpers', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('returns placeholder params when public shell prerendering is enabled', async () => {
    vi.stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'true')
    const { getPublicShellStaticParams } = await import('@/lib/static-params')

    expect(getPublicShellStaticParams({ slug: '__placeholder__' })).toEqual([
      { slug: '__placeholder__' },
    ])
  })

  it('still returns placeholder params when public shell prerendering is disabled', async () => {
    vi.stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'false')
    const { getPublicShellStaticParams } = await import('@/lib/static-params')

    expect(getPublicShellStaticParams({ slug: '__placeholder__' })).toEqual([
      { slug: '__placeholder__' },
    ])
  })

  it('bypasses placeholder renders only in runtime-env builds', async () => {
    vi.stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'false')
    const { shouldBypassPublicShellPlaceholder } = await import('@/lib/static-params')

    expect(shouldBypassPublicShellPlaceholder('__placeholder__')).toBe(true)
    expect(shouldBypassPublicShellPlaceholder(['sports', '__placeholder__'])).toBe(true)
    expect(shouldBypassPublicShellPlaceholder('sports')).toBe(false)
  })

  it('keeps placeholder renders active in prerender builds', async () => {
    vi.stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'true')
    const { shouldBypassPublicShellPlaceholder } = await import('@/lib/static-params')

    expect(shouldBypassPublicShellPlaceholder('__placeholder__')).toBe(false)
  })
})
