import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualNextCache from 'next/cache'
import { isValidElement } from 'react'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  findDynamicHomeCategoryBySlug: mock(),
  findDynamicHomeSubcategoryBySlug: mock(),
  loadPlatformMainTags: mock(),
  notFound: mock(),
}))

void mock.module('next/navigation', () => ({
  notFound: () => mocks.notFound(),
}))

void mock.module('next/cache', () => ({
  ...actualNextCache,
  cacheLife: mock(),
}))

void mock.module('@/app/[locale]/(platform)/(home)/_components/HomeContent', () => ({
  default: () => null,
}))

void mock.module('@/lib/platform-main-tags', () => ({
  loadPlatformMainTags: (...args: any[]) => mocks.loadPlatformMainTags(...args),
}))

void mock.module('@/lib/platform-routing', () => ({
  findDynamicHomeCategoryBySlug: (...args: any[]) => mocks.findDynamicHomeCategoryBySlug(...args),
  findDynamicHomeSubcategoryBySlug: (...args: any[]) => mocks.findDynamicHomeSubcategoryBySlug(...args),
  getMainTagSeoTitle: (value: string) => value,
}))

describe('dynamicHomeCategoryPage', () => {
  beforeEach(() => {
    mocks.findDynamicHomeCategoryBySlug.mockReset()
    mocks.findDynamicHomeSubcategoryBySlug.mockReset()
    mocks.loadPlatformMainTags.mockReset()
    mocks.notFound.mockReset()
    mocks.loadPlatformMainTags.mockResolvedValue({ data: [] })
    mocks.notFound.mockImplementation(() => {
      throw new Error('not found')
    })
  })

  it('routes category pages through cached timestamped home content', async () => {
    mocks.findDynamicHomeCategoryBySlug.mockReturnValueOnce({
      slug: 'crypto',
      name: 'Crypto',
    })

    const { DynamicHomeCategoryPageContent } = await import('@/app/[locale]/(platform)/_lib/dynamic-home-category-page')
    const result = await DynamicHomeCategoryPageContent({
      slug: 'crypto',
    })

    expect(isValidElement(result)).toBe(true)
    expect((result as any).props).toEqual(
      expect.objectContaining({
        initialTag: 'crypto',
      }),
    )
  })

  it('routes subcategory pages through cached timestamped home content', async () => {
    mocks.findDynamicHomeSubcategoryBySlug.mockReturnValueOnce({
      category: { slug: 'crypto', name: 'Crypto' },
      subcategory: { slug: 'crypto-prices', name: 'Crypto Prices' },
    })

    const { DynamicHomeSubcategoryPageContent } =
      await import('@/app/[locale]/(platform)/_lib/dynamic-home-category-page')
    const result = await DynamicHomeSubcategoryPageContent({
      slug: 'crypto',
      subcategory: 'crypto-prices',
    })

    expect(isValidElement(result)).toBe(true)
    expect((result as any).props).toEqual(
      expect.objectContaining({
        initialMainTag: 'crypto',
        initialTag: 'crypto-prices',
      }),
    )
  })
})
