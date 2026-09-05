import { afterEach, describe, expect, it } from 'bun:test'

import { stubEnv, unstubAllEnvs } from '../bun-test-helpers'

describe('static params helpers', () => {
  afterEach(() => {
    unstubAllEnvs()
  })

  it('returns placeholder params when public shell prerendering is enabled', async () => {
    stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'true')
    const { getPublicShellStaticParams } = await import('@/lib/static-params')

    expect(getPublicShellStaticParams({ slug: '__placeholder__' })).toEqual([{ slug: '__placeholder__' }])
  })

  it('still returns placeholder params when public shell prerendering is disabled', async () => {
    stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'false')
    const { getPublicShellStaticParams } = await import('@/lib/static-params')

    expect(getPublicShellStaticParams({ slug: '__placeholder__' })).toEqual([{ slug: '__placeholder__' }])
  })

  it('bypasses placeholder renders only in runtime-env builds', async () => {
    stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'false')
    const { shouldBypassPublicShellPlaceholder } = await import('@/lib/static-params')

    expect(shouldBypassPublicShellPlaceholder('__placeholder__')).toBe(true)
    expect(shouldBypassPublicShellPlaceholder(['sports', '__placeholder__'])).toBe(true)
    expect(shouldBypassPublicShellPlaceholder('sports')).toBe(false)
  })

  it('keeps placeholder renders active in prerender builds', async () => {
    stubEnv('BUILD_PRERENDER_PUBLIC_SHELL', 'true')
    const { shouldBypassPublicShellPlaceholder } = await import('@/lib/static-params')

    expect(shouldBypassPublicShellPlaceholder('__placeholder__')).toBe(false)
  })
})
