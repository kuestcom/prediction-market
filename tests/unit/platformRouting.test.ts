import { describe, expect, it } from 'vitest'
import {
  buildDynamicHomeCategorySlugSet,
  buildPublicProfilePath,
  buildUsernameProfilePath,
  findDynamicHomeCategoryBySlug,
  findDynamicHomeSubcategoryBySlug,
  isDynamicHomeCategorySlug,
  normalizePublicProfileSlug,
} from '@/lib/platform-routing'

describe('platform routing helpers', () => {
  it('filters dynamic home categories away from reserved and special slugs', () => {
    expect(buildDynamicHomeCategorySlugSet([
      { slug: 'trending' },
      { slug: 'new' },
      { slug: 'politics' },
      { slug: 'sports' },
      { slug: 'iran' },
    ])).toEqual(new Set(['politics', 'iran']))
  })

  it('finds a dynamic home category by slug', () => {
    expect(findDynamicHomeCategoryBySlug([
      { slug: 'politics', name: 'Politics' },
      { slug: 'iran', name: 'Iran' },
    ], 'iran')).toEqual({ slug: 'iran', name: 'Iran' })
  })

  it('finds a dynamic home subcategory by parent slug', () => {
    expect(findDynamicHomeSubcategoryBySlug([
      {
        slug: 'iran',
        name: 'Iran',
        childs: [{ slug: 'oil', name: 'Oil' }],
      },
    ], 'iran', 'oil')).toEqual({
      category: {
        slug: 'iran',
        name: 'Iran',
        childs: [{ slug: 'oil', name: 'Oil' }],
      },
      subcategory: { slug: 'oil', name: 'Oil' },
    })
  })

  it('normalizes username and address profile slugs', () => {
    expect(normalizePublicProfileSlug('@bruno')).toEqual({ type: 'username', value: 'bruno' })
    expect(normalizePublicProfileSlug('0x1234567890123456789012345678901234567890')).toEqual({
      type: 'address',
      value: '0x1234567890123456789012345678901234567890',
    })
  })

  it('builds public profile paths with @username and bare addresses', () => {
    expect(buildPublicProfilePath('bruno')).toBe('/@bruno')
    expect(buildPublicProfilePath('@bruno')).toBe('/@bruno')
    expect(buildPublicProfilePath('0x1234567890123456789012345678901234567890')).toBe(
      '/0x1234567890123456789012345678901234567890',
    )
  })

  it('builds username-only profile paths without accepting wallet addresses', () => {
    expect(buildUsernameProfilePath('bruno')).toBe('/@bruno')
    expect(buildUsernameProfilePath('@bruno')).toBe('/@bruno')
    expect(buildUsernameProfilePath('0x1234567890123456789012345678901234567890')).toBeNull()
  })

  it('does not treat reserved or invalid slugs as dynamic categories', () => {
    expect(isDynamicHomeCategorySlug('event')).toBe(false)
    expect(isDynamicHomeCategorySlug('@bruno')).toBe(false)
    expect(isDynamicHomeCategorySlug('0x1234567890123456789012345678901234567890')).toBe(false)
    expect(isDynamicHomeCategorySlug('iran')).toBe(true)
  })
})
