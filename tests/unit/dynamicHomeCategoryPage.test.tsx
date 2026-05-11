import { isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findDynamicHomeCategoryBySlug: vi.fn(),
  findDynamicHomeSubcategoryBySlug: vi.fn(),
  loadPlatformMainTags: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => mocks.notFound(),
}))

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
}))

vi.mock('@/app/[locale]/(platform)/(home)/_components/HomeContent', () => ({
  default: () => null,
}))

vi.mock('@/lib/platform-main-tags', () => ({
  loadPlatformMainTags: (...args: any[]) => mocks.loadPlatformMainTags(...args),
}))

vi.mock('@/lib/platform-routing', () => ({
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
      locale: 'en',
      slug: 'crypto',
    })

    expect(isValidElement(result)).toBe(true)
    expect((result as any).props).toEqual(expect.objectContaining({
      initialTag: 'crypto',
      locale: 'en',
    }))
  })

  it('routes subcategory pages through cached timestamped home content', async () => {
    mocks.findDynamicHomeSubcategoryBySlug.mockReturnValueOnce({
      category: { slug: 'crypto', name: 'Crypto' },
      subcategory: { slug: 'crypto-prices', name: 'Crypto Prices' },
    })

    const { DynamicHomeSubcategoryPageContent } = await import('@/app/[locale]/(platform)/_lib/dynamic-home-category-page')
    const result = await DynamicHomeSubcategoryPageContent({
      locale: 'en',
      slug: 'crypto',
      subcategory: 'crypto-prices',
    })

    expect(isValidElement(result)).toBe(true)
    expect((result as any).props).toEqual(expect.objectContaining({
      initialMainTag: 'crypto',
      initialTag: 'crypto-prices',
      locale: 'en',
    }))
  })
})
