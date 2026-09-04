import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  calls: [] as string[],
  deferPublicShellPrerenderIfNeeded: mock(),
  getExtracted: mock(),
  loadRuntimeThemeState: mock(),
  resolveSiteUrl: mock(),
  setRequestLocale: mock(),
}))

void mock.module('next-intl/server', () => ({
  getExtracted: (...args: any[]) => mocks.getExtracted(...args),
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

void mock.module('@/app/[locale]/(platform)/leaderboard/_components/LeaderboardClient', () => ({
  default: () => null,
}))

void mock.module('@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPageSkeleton', () => ({
  default: () => null,
}))

void mock.module('@/lib/public-shell-rendering', () => ({
  deferPublicShellPrerenderIfNeeded: (...args: any[]) => mocks.deferPublicShellPrerenderIfNeeded(...args),
}))

void mock.module('@/lib/site-url', () => ({
  default: (...args: any[]) => mocks.resolveSiteUrl(...args),
}))

void mock.module('@/lib/theme-settings', () => ({
  loadRuntimeThemeState: (...args: any[]) => mocks.loadRuntimeThemeState(...args),
}))

describe('leaderboard metadata', () => {
  beforeEach(() => {
    mocks.calls.length = 0
    mocks.deferPublicShellPrerenderIfNeeded.mockReset()
    mocks.getExtracted.mockReset()
    mocks.loadRuntimeThemeState.mockReset()
    mocks.resolveSiteUrl.mockReset()
    mocks.setRequestLocale.mockReset()

    mocks.deferPublicShellPrerenderIfNeeded.mockImplementation(async () => {
      mocks.calls.push('defer')
    })
    mocks.getExtracted.mockResolvedValue((key: string, values?: Record<string, string>) => {
      if (key === 'See top traders and biggest wins on {siteName}') {
        return `See top traders and biggest wins on ${values?.siteName ?? ''}`
      }

      return key
    })
    mocks.loadRuntimeThemeState.mockResolvedValue({ site: { name: 'Kuest' } })
    mocks.resolveSiteUrl.mockImplementation(() => {
      mocks.calls.push('resolve-site-url')
      return 'https://demo.kuest.com'
    })
  })

  it('defers prerendering before resolving absolute social URLs', async () => {
    const { generateMetadata } = await import('@/app/[locale]/(platform)/leaderboard/[[...filters]]/page')

    const metadata = await generateMetadata({
      params: Promise.resolve({
        locale: 'en',
        filters: ['sports', 'weekly', 'volume'],
      }),
    } as any)

    const serializedMetadata = JSON.stringify(metadata)
    const firstResolveIndex = mocks.calls.indexOf('resolve-site-url')

    expect(mocks.calls.indexOf('defer')).toBeGreaterThanOrEqual(0)
    expect(firstResolveIndex).toBeGreaterThan(mocks.calls.indexOf('defer'))
    expect(metadata.openGraph?.url).toBe('https://demo.kuest.com/leaderboard/sports/weekly/volume')
    expect(serializedMetadata).toContain('https://demo.kuest.com/api/og/leaderboard')
    expect(serializedMetadata).not.toContain('localhost:3000')
  })
})
