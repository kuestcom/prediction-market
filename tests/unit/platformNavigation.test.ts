import { describe, expect, it } from 'vitest'
import {
  buildChildParentMap,
  buildPlatformNavigationTags,
  parsePlatformPathname,
  resolvePlatformNavigationSelection,
} from '@/lib/platform-navigation'

const dynamicHomeCategorySlugSet = new Set(['geopolitics', 'politics'])

describe('platform navigation helpers', () => {
  it('builds navigation tags with trending and new wrappers', () => {
    const tags = buildPlatformNavigationTags({
      trendingLabel: 'Trending',
      newLabel: 'New',
      globalChilds: [{ slug: 'ukraine', name: 'Ukraine' }],
      mainTags: [{ slug: 'geopolitics', name: 'Geopolitics', childs: [{ slug: 'ukraine', name: 'Ukraine' }] }],
    })

    expect(tags.map(tag => tag.slug)).toEqual(['trending', 'new', 'geopolitics'])
    expect(tags[0].childs).toEqual([{ slug: 'ukraine', name: 'Ukraine' }])
    expect(tags[1].childs).toEqual([{ slug: 'ukraine', name: 'Ukraine' }])
    expect(tags[2].childs).toEqual([{ slug: 'ukraine', name: 'Ukraine' }])
  })

  it('creates a child-parent map from main tags', () => {
    expect(buildChildParentMap([
      { slug: 'politics', childs: [{ slug: 'trump', name: 'Trump' }] },
      { slug: 'geopolitics', childs: [{ slug: 'ukraine', name: 'Ukraine' }] },
    ])).toEqual({
      trump: 'politics',
      ukraine: 'geopolitics',
    })
  })

  it('parses category subcategory paths', () => {
    expect(parsePlatformPathname('/politics/trump', dynamicHomeCategorySlugSet)).toMatchObject({
      isHomeLikePage: true,
      isMainTagPathPage: true,
      isSportsPathPage: false,
      selectedMainTagPathSlug: 'politics',
      selectedSubtagPathSlug: 'trump',
    })
  })

  it('keeps the route category active on category pages even before filters sync', () => {
    const selection = resolvePlatformNavigationSelection({
      dynamicHomeCategorySlugSet,
      pathname: '/geopolitics',
      filters: {
        tag: 'trending',
        mainTag: 'trending',
        bookmarked: false,
      },
      childParentMap: {
        ukraine: 'geopolitics',
      },
    })

    expect(selection.activeMainTagSlug).toBe('geopolitics')
    expect(selection.activeTagSlug).toBe('geopolitics')
  })

  it('keeps subcategory paths selected from the pathname', () => {
    const selection = resolvePlatformNavigationSelection({
      dynamicHomeCategorySlugSet,
      pathname: '/politics/trump',
      filters: {
        tag: 'trending',
        mainTag: 'trending',
        bookmarked: false,
      },
      childParentMap: {
        trump: 'politics',
      },
    })

    expect(selection.activeMainTagSlug).toBe('politics')
    expect(selection.activeTagSlug).toBe('trump')
  })

  it('preserves the originating category highlight on event pages', () => {
    const selection = resolvePlatformNavigationSelection({
      dynamicHomeCategorySlugSet,
      pathname: '/event/will-russia-enter-verkhnia-tersa-by-february-28',
      filters: {
        tag: 'ukraine',
        mainTag: 'geopolitics',
        bookmarked: false,
      },
      childParentMap: {
        ukraine: 'geopolitics',
      },
    })

    expect(selection.activeMainTagSlug).toBe('geopolitics')
    expect(selection.activeTagSlug).toBe('ukraine')
  })

  it('keeps trending active on the home page even when filters still reference another category', () => {
    const selection = resolvePlatformNavigationSelection({
      dynamicHomeCategorySlugSet,
      pathname: '/',
      filters: {
        tag: 'trump',
        mainTag: '',
        bookmarked: false,
      },
      childParentMap: {
        trump: 'politics',
      },
    })

    expect(selection.activeMainTagSlug).toBe('trending')
    expect(selection.activeTagSlug).toBe('trump')
  })

  it('keeps trending active when navigating back from /new before filters sync', () => {
    const selection = resolvePlatformNavigationSelection({
      dynamicHomeCategorySlugSet,
      pathname: '/',
      filters: {
        tag: 'new',
        mainTag: 'new',
        bookmarked: false,
      },
      childParentMap: {},
    })

    expect(selection.activeMainTagSlug).toBe('trending')
    expect(selection.activeTagSlug).toBe('new')
  })
})
