import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import { describe, expect, it } from 'vitest'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'

const menuEntries: SportsMenuEntry[] = [
  {
    type: 'link' as const,
    id: 'sports-live',
    label: 'Live',
    href: '/sports/live',
    iconPath: '/icons/live.svg',
    menuSlug: null,
  },
  {
    type: 'group' as const,
    id: 'sports-football',
    label: 'Football',
    href: '/sports/football/props',
    iconPath: '/icons/football.svg',
    menuSlug: 'football',
    links: [
      {
        type: 'link' as const,
        id: 'sports-nfl',
        label: 'NFL',
        href: '/sports/nfl/props',
        iconPath: '/icons/nfl.svg',
        menuSlug: 'nfl',
      },
      {
        type: 'link' as const,
        id: 'sports-cfb',
        label: 'CFB',
        href: '/sports/cfb/props',
        iconPath: '/icons/cfb.svg',
        menuSlug: 'cfb',
      },
    ],
  },
  {
    type: 'link' as const,
    id: 'sports-futures-nba',
    label: 'Futures',
    href: '/sports/futures/nba',
    iconPath: '/icons/futures.svg',
    menuSlug: 'nba',
  },
]

describe('sports menu routing helpers', () => {
  it('returns aggregate group hrefs for group slugs', () => {
    expect(findSportsHrefBySlug({
      menuEntries,
      canonicalSportSlug: 'football',
    })).toBe('/sports/football/props')
  })

  it('can restrict matches to a required href prefix', () => {
    expect(findSportsHrefBySlug({
      menuEntries,
      canonicalSportSlug: 'football',
      hrefPrefix: '/sports/futures/',
    })).toBeNull()
    expect(findSportsHrefBySlug({
      menuEntries,
      canonicalSportSlug: 'nba',
      hrefPrefix: '/sports/futures/',
    })).toBe('/sports/futures/nba')
  })
})
