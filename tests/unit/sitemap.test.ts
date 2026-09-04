import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'
import * as actualNextCache from 'next/cache'

import { hoisted, useFakeTimers, useRealTimers } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  cacheTag: mock(),
  getPages: mock(),
}))

void mock.module('next/cache', () => ({
  ...actualNextCache,
  cacheTag: (...args: any[]) => mocks.cacheTag(...args),
  unstable_cache: (callback: (...args: any[]) => unknown) => callback,
}))

void mock.module('@/lib/source', () => ({
  source: {
    getPages: (...args: any[]) => mocks.getPages(...args),
  },
}))

const { DOCS_SITEMAP_ID, buildDocsSitemapEntries, getDynamicSitemapEntriesById } = await import('@/lib/sitemap')

describe('sitemap docs entries', () => {
  beforeEach(() => {
    mocks.cacheTag.mockReset()
    mocks.getPages.mockReset()
  })

  afterEach(() => {
    useRealTimers()
  })

  it('keeps only canonical docs paths sorted and deduped', () => {
    const entries = buildDocsSitemapEntries(
      [
        { url: '/docs/users/getting-started/' },
        { url: '/activity' },
        { url: ' /docs ' },
        { url: '/docs/users/getting-started' },
        { url: '/docs/api-reference' },
      ],
      '2026-04-27',
    )

    expect(entries).toEqual([
      { path: '/docs', lastModified: '2026-04-27' },
      { path: '/docs/api-reference', lastModified: '2026-04-27' },
      { path: '/docs/users/getting-started', lastModified: '2026-04-27' },
    ])
  })

  it('serves the docs sitemap from the docs source', async () => {
    useFakeTimers()
    jest.setSystemTime(new Date('2026-04-27T12:00:00.000Z'))
    mocks.getPages.mockReturnValue([{ url: '/docs' }, { url: '/docs/api-reference/rate-limits' }])

    await expect(getDynamicSitemapEntriesById(DOCS_SITEMAP_ID)).resolves.toEqual([
      { path: '/docs', lastModified: '2026-04-27' },
      { path: '/docs/api-reference/rate-limits', lastModified: '2026-04-27' },
    ])
  })
})
