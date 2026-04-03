import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import { describe, expect, it } from 'vitest'
import { buildSportsMenuCountsBySlug } from '@/lib/sports-menu-counts'
import {
  resolveSportsSidebarCountKey,
  SPORTS_SIDEBAR_FUTURE_COUNT_KEY,
  SPORTS_SIDEBAR_LIVE_COUNT_KEY,
} from '@/lib/sports-sidebar-counts'
import { buildSportsSlugResolver } from '@/lib/sports-slug-mapping'

function buildLinkEntry(params: {
  id: string
  label: string
  href: string
  menuSlug?: string | null
}): SportsMenuEntry {
  return {
    type: 'link',
    id: params.id,
    label: params.label,
    href: params.href,
    iconPath: `/icons/${params.id}.svg`,
    menuSlug: params.menuSlug ?? null,
  }
}

describe('buildSportsMenuCountsBySlug', () => {
  it('maps sports soon and legacy futures links to the same future sidebar bucket', () => {
    expect(resolveSportsSidebarCountKey({
      href: '/sports/soon',
      vertical: 'sports',
    })).toBe(SPORTS_SIDEBAR_FUTURE_COUNT_KEY)

    expect(resolveSportsSidebarCountKey({
      href: '/sports/futures/nba',
      vertical: 'sports',
    })).toBe(SPORTS_SIDEBAR_FUTURE_COUNT_KEY)
  })

  it('counts live and future sidebar buckets and matches events by sports_series_slug aliases', () => {
    const resolver = buildSportsSlugResolver([
      {
        menuSlug: 'league-of-legends',
        h1Title: 'League of Legends',
        aliases: ['lol', 'LoL'],
        sections: {
          gamesEnabled: true,
          propsEnabled: true,
        },
      },
      {
        menuSlug: 'counter-strike',
        h1Title: 'Counter-Strike',
        aliases: ['cs2', 'CS2'],
        sections: {
          gamesEnabled: true,
          propsEnabled: true,
        },
      },
    ])

    const menuEntries: SportsMenuEntry[] = [
      buildLinkEntry({ id: 'live', label: 'Live', href: '/esports/live' }),
      buildLinkEntry({ id: 'upcoming', label: 'Upcoming', href: '/esports/soon' }),
      buildLinkEntry({
        id: 'lol',
        label: 'LoL',
        href: '/esports/league-of-legends/games',
        menuSlug: 'league-of-legends',
      }),
      buildLinkEntry({
        id: 'cs2',
        label: 'CS2',
        href: '/esports/cs2/games',
        menuSlug: 'counter-strike',
      }),
    ]

    const now = new Date('2026-04-02T12:00:00.000Z')
    const counts = buildSportsMenuCountsBySlug(
      resolver,
      [
        {
          slug: null,
          series_slug: 'league-of-legends',
          event_slug: 'league-of-legends-match-1',
          sports_event_id: 'league-of-legends-match-1',
          sports_event_slug: 'league-of-legends-match-1',
          parent_event_id: null,
          tags: ['Games'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-02T15:00:00.000Z'),
          start_date: new Date('2026-04-02T15:00:00.000Z'),
          end_date: new Date('2026-04-02T17:00:00.000Z'),
        },
        {
          slug: 'cs2',
          series_slug: null,
          event_slug: 'cs2-match-1',
          sports_event_id: 'cs2-match-1',
          sports_event_slug: 'cs2-match-1',
          parent_event_id: null,
          tags: ['Games'],
          is_hidden: false,
          sports_live: true,
          sports_ended: false,
          sports_start_time: new Date('2026-04-02T10:00:00.000Z'),
          start_date: new Date('2026-04-02T10:00:00.000Z'),
          end_date: new Date('2026-04-02T14:00:00.000Z'),
        },
      ],
      menuEntries,
      now.getTime(),
    )

    expect(counts).toMatchObject({
      'league-of-legends::games': 1,
      'counter-strike::games': 1,
      [SPORTS_SIDEBAR_LIVE_COUNT_KEY]: 1,
      [SPORTS_SIDEBAR_FUTURE_COUNT_KEY]: 1,
    })
  })

  it('ignores slugs that are not present in the current vertical menu', () => {
    const resolver = buildSportsSlugResolver([
      {
        menuSlug: 'league-of-legends',
        h1Title: 'League of Legends',
        aliases: ['lol'],
        sections: {
          gamesEnabled: true,
          propsEnabled: true,
        },
      },
      {
        menuSlug: 'basketball',
        h1Title: 'Basketball',
        sections: {
          gamesEnabled: true,
          propsEnabled: true,
        },
      },
    ])

    const menuEntries: SportsMenuEntry[] = [
      buildLinkEntry({
        id: 'lol',
        label: 'LoL',
        href: '/esports/league-of-legends/games',
        menuSlug: 'league-of-legends',
      }),
    ]

    const counts = buildSportsMenuCountsBySlug(
      resolver,
      [
        {
          slug: 'basketball',
          series_slug: null,
          event_slug: 'basketball-match-1',
          sports_event_id: 'basketball-match-1',
          sports_event_slug: 'basketball-match-1',
          parent_event_id: null,
          tags: [],
          is_hidden: false,
          sports_live: true,
          sports_ended: false,
          sports_start_time: new Date('2026-04-02T10:00:00.000Z'),
          start_date: new Date('2026-04-02T10:00:00.000Z'),
          end_date: new Date('2026-04-02T14:00:00.000Z'),
        },
      ],
      menuEntries,
      new Date('2026-04-02T12:00:00.000Z').getTime(),
    )

    expect(counts).toEqual({})
  })

  it('prefers direct slug classification and only counts rows for matching sidebar sections', () => {
    const resolver = buildSportsSlugResolver([
      {
        menuSlug: 'zuffa',
        h1Title: 'Zuffa',
        label: 'Zuffa',
        sections: {
          gamesEnabled: true,
          propsEnabled: false,
        },
      },
      {
        menuSlug: 'boxing',
        h1Title: 'Boxing',
        label: 'Boxing',
        sections: {
          gamesEnabled: false,
          propsEnabled: true,
        },
      },
    ])

    const menuEntries: SportsMenuEntry[] = [
      buildLinkEntry({
        id: 'boxing',
        label: 'Boxing',
        href: '/sports/boxing/props',
        menuSlug: 'boxing',
      }),
      {
        type: 'group',
        id: 'ufc',
        label: 'UFC',
        href: '/sports/ufc/props',
        iconPath: '/icons/ufc.svg',
        menuSlug: 'ufc',
        links: [
          {
            type: 'link',
            id: 'zuffa',
            label: 'Zuffa',
            href: '/sports/zuffa/games',
            iconPath: '/icons/zuffa.svg',
            menuSlug: 'zuffa',
          },
        ],
      },
    ]

    const counts = buildSportsMenuCountsBySlug(
      resolver,
      [
        {
          slug: 'zuffa',
          series_slug: 'zuffa',
          event_slug: 'zuffa-a-b-1',
          sports_event_id: 'zuffa-a-b-1',
          sports_event_slug: 'zuffa-a-b-1',
          parent_event_id: null,
          tags: ['Sports', 'Games', 'Boxing', 'Zuffa'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-05T15:00:00.000Z'),
          start_date: new Date('2026-04-05T15:00:00.000Z'),
          end_date: new Date('2026-04-05T17:00:00.000Z'),
        },
        {
          slug: 'zuffa',
          series_slug: 'zuffa',
          event_slug: 'zuffa-c-d-1',
          sports_event_id: 'zuffa-c-d-1',
          sports_event_slug: 'zuffa-c-d-1',
          parent_event_id: null,
          tags: ['Sports', 'Games', 'Zuffa', 'Boxing'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-05T18:00:00.000Z'),
          start_date: new Date('2026-04-05T18:00:00.000Z'),
          end_date: new Date('2026-04-05T20:00:00.000Z'),
        },
        {
          slug: 'zuffa',
          series_slug: 'zuffa',
          event_slug: 'zuffa-e-f-1',
          sports_event_id: 'zuffa-e-f-1',
          sports_event_slug: 'zuffa-e-f-1',
          parent_event_id: null,
          tags: ['Sports', 'Zuffa', 'Boxing', 'Games'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-05T21:00:00.000Z'),
          start_date: new Date('2026-04-05T21:00:00.000Z'),
          end_date: new Date('2026-04-05T23:00:00.000Z'),
        },
      ],
      menuEntries,
      new Date('2026-04-02T12:00:00.000Z').getTime(),
    )

    expect(counts).toMatchObject({
      'zuffa::games': 3,
    })
    expect(counts['boxing::props']).toBeUndefined()
  })

  it('dedupes sidebar counts across grouped auxiliary game rows', () => {
    const resolver = buildSportsSlugResolver([
      {
        menuSlug: 'crint',
        h1Title: 'International',
        label: 'International',
        sections: {
          gamesEnabled: true,
          propsEnabled: true,
        },
      },
    ])

    const menuEntries: SportsMenuEntry[] = [
      buildLinkEntry({
        id: 'crint',
        label: 'International',
        href: '/sports/crint/games',
        menuSlug: 'crint',
      }),
    ]

    const counts = buildSportsMenuCountsBySlug(
      resolver,
      [
        {
          slug: 'international',
          series_slug: 'international-cricket',
          event_slug: 'crint-nam-sco-2026-04-06',
          sports_event_id: '334449',
          sports_event_slug: 'crint-nam-sco-2026-04-06',
          parent_event_id: null,
          tags: ['Sports', 'Games', 'Cricket', 'International Cricket'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-06T15:00:00.000Z'),
          start_date: new Date('2026-04-06T15:00:00.000Z'),
          end_date: new Date('2026-04-06T17:00:00.000Z'),
        },
        {
          slug: 'international',
          series_slug: 'international-cricket',
          event_slug: 'crint-nam-sco-2026-04-06-team-top-batter',
          sports_event_id: '334451',
          sports_event_slug: 'crint-nam-sco-2026-04-06-team-top-batter',
          parent_event_id: 334449,
          tags: ['Sports', 'Games', 'Cricket', 'International Cricket'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-06T15:00:00.000Z'),
          start_date: new Date('2026-04-06T15:00:00.000Z'),
          end_date: new Date('2026-04-06T17:00:00.000Z'),
        },
        {
          slug: 'international',
          series_slug: 'international-cricket',
          event_slug: 'crint-prt-nor-2026-04-07',
          sports_event_id: '334493',
          sports_event_slug: 'crint-prt-nor-2026-04-07',
          parent_event_id: null,
          tags: ['Sports', 'Games', 'Cricket', 'International Cricket'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-07T15:00:00.000Z'),
          start_date: new Date('2026-04-07T15:00:00.000Z'),
          end_date: new Date('2026-04-07T17:00:00.000Z'),
        },
        {
          slug: 'international',
          series_slug: 'international-cricket',
          event_slug: 'crint-prt-nor-2026-04-07-most-sixes',
          sports_event_id: '334495',
          sports_event_slug: 'crint-prt-nor-2026-04-07-most-sixes',
          parent_event_id: '334493',
          tags: ['Sports', 'Games', 'Cricket', 'International Cricket'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-07T15:00:00.000Z'),
          start_date: new Date('2026-04-07T15:00:00.000Z'),
          end_date: new Date('2026-04-07T17:00:00.000Z'),
        },
        {
          slug: 'international',
          series_slug: 'international-cricket',
          event_slug: 'crint-prt-nor-2026-04-07-team-top-batter',
          sports_event_id: '334496',
          sports_event_slug: 'crint-prt-nor-2026-04-07-team-top-batter',
          parent_event_id: '334493',
          tags: ['Sports', 'Games', 'Cricket', 'International Cricket'],
          is_hidden: false,
          sports_live: false,
          sports_ended: false,
          sports_start_time: new Date('2026-04-07T15:00:00.000Z'),
          start_date: new Date('2026-04-07T15:00:00.000Z'),
          end_date: new Date('2026-04-07T17:00:00.000Z'),
        },
      ],
      menuEntries,
      new Date('2026-04-02T12:00:00.000Z').getTime(),
    )

    expect(counts['crint::games']).toBe(2)
  })
})
