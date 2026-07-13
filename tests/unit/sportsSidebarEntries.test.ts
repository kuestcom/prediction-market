import type { SportsMenuGroupEntry } from '@/lib/sports-menu-types'
import type { SportsMenuSidebarRow } from '@/lib/sports-sidebar-entries'
import { describe, expect, it } from 'vitest'
import {
  buildSportsSidebarEntries,
} from '@/lib/sports-sidebar-entries'

function isSportsMenuGroupEntry(entry: ReturnType<typeof buildSportsSidebarEntries>[number]): entry is SportsMenuGroupEntry {
  return entry.type === 'group'
}

function findSportsMenuGroup(
  entries: ReturnType<typeof buildSportsSidebarEntries>,
  menuSlug: string,
) {
  return entries.filter(isSportsMenuGroupEntry).find(entry => entry.menuSlug === menuSlug)
}

function buildLinkRow(params: {
  id: string
  href: string
  label: string
  menuSlug?: string | null
  parentId?: string | null
}): SportsMenuSidebarRow {
  return {
    id: params.id,
    item_type: 'link',
    label: params.label,
    href: params.href,
    icon_url: `/icons/${params.id}.svg`,
    parent_id: params.parentId ?? null,
    menu_slug: params.menuSlug ?? null,
  }
}

function buildGroupRow(params: {
  id: string
  label: string
}): SportsMenuSidebarRow {
  return {
    id: params.id,
    item_type: 'group',
    label: params.label,
    href: null,
    icon_url: `/icons/${params.id}.svg`,
    parent_id: null,
    menu_slug: null,
  }
}

function buildChildLinkRows(
  parentId: string,
  rows: Array<{
    href: string
    label: string
    menuSlug?: string | null
  }>,
) {
  return rows.map(row => buildLinkRow({
    id: `${parentId}-link-${row.menuSlug ?? row.label.toLowerCase().replaceAll(' ', '-')}`,
    href: row.href,
    label: row.label,
    menuSlug: row.menuSlug,
    parentId,
  }))
}

function buildEsportsChildLinkRows(
  parentId: string,
  rows: Array<{
    href: string
    label: string
    slug: string
  }>,
) {
  return rows.map(row => buildLinkRow({
    id: `${parentId}-${row.slug}`,
    href: row.href,
    label: row.label,
    parentId,
  }))
}

function flattenMenuHrefs(rows: ReturnType<typeof buildSportsSidebarEntries>) {
  return rows.flatMap((entry) => {
    if (entry.type === 'link') {
      return [entry.href]
    }

    if (entry.type === 'group') {
      return [entry.href, ...entry.links.map(link => link.href)]
    }

    return []
  })
}

describe('sports sidebar entries', () => {
  it('uses the admin category configuration for feature, visibility, and order', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({
        id: 'top-link-live-sports-live-0',
        label: 'Live',
        href: '/sports/live',
      }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      {
        ...buildGroupRow({ id: 'group-soccer', label: 'Soccer' }),
        menu_slug: 'soccer',
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 1,
      },
      {
        ...buildLinkRow({
          id: 'soccer-all',
          label: 'All',
          href: '/sports/soccer/games',
          menuSlug: 'soccer',
          parentId: 'group-soccer',
        }),
        sort_order: 0,
        sidebar_enabled: true,
      },
      {
        ...buildLinkRow({
          id: 'soccer-world-cup',
          label: 'World Cup',
          href: '/sports/world-cup',
          menuSlug: 'world-cup',
          parentId: 'group-soccer',
        }),
        sort_order: 1,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: true,
        sidebar_sort_order: 0,
      },
      {
        ...buildLinkRow({
          id: 'tennis',
          label: 'Tennis',
          href: '/sports/tennis/games',
          menuSlug: 'tennis',
        }),
        sidebar_category: true,
        sidebar_enabled: false,
        sidebar_featured: false,
        sidebar_sort_order: 0,
      },
    ]

    const entries = buildSportsSidebarEntries(rows, 'sports')

    expect(entries.map(entry => entry.type === 'divider' ? 'divider' : entry.label)).toEqual([
      'Live',
      'Upcoming',
      'divider',
      'All Sports',
      'World Cup',
      'Soccer',
    ])
    expect(entries).not.toContainEqual(expect.objectContaining({ label: 'Tennis' }))
    expect(entries.at(-1)).toMatchObject({
      type: 'group',
      label: 'Soccer',
      links: [
        expect.objectContaining({ label: 'All' }),
        expect.objectContaining({ label: 'World Cup' }),
      ],
    })
  })

  it('uses the esports admin configuration without leaking sports categories', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({
        id: 'top-link-live-sports-live-0',
        label: 'Live',
        href: '/sports/live',
      }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      {
        ...buildGroupRow({ id: 'group-esports-league-of-legends', label: 'LoL' }),
        href: '/esports/league-of-legends/games',
        menu_slug: 'league-of-legends',
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 1,
      },
      {
        ...buildLinkRow({
          id: 'group-esports-league-of-legends-games',
          label: 'Games',
          href: '/esports/league-of-legends/games',
          parentId: 'group-esports-league-of-legends',
        }),
        sort_order: 0,
        sidebar_category: true,
        sidebar_enabled: true,
      },
      {
        ...buildGroupRow({ id: 'group-esports-cs2', label: 'CS2' }),
        href: '/esports/cs2/games',
        menu_slug: 'counter-strike',
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: true,
        sidebar_sort_order: 0,
      },
      {
        ...buildLinkRow({
          id: 'group-esports-cs2-games',
          label: 'Games',
          href: '/esports/cs2/games',
          parentId: 'group-esports-cs2',
        }),
        sort_order: 0,
        sidebar_category: true,
        sidebar_enabled: true,
      },
      {
        ...buildGroupRow({ id: 'group-esports-dota-2', label: 'Dota 2' }),
        menu_slug: 'dota-2',
        sidebar_category: true,
        sidebar_enabled: false,
        sidebar_featured: false,
        sidebar_sort_order: 0,
      },
      {
        ...buildLinkRow({
          id: 'soccer',
          label: 'Soccer',
          href: '/sports/soccer/games',
          menuSlug: 'soccer',
        }),
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: true,
        sidebar_sort_order: 0,
      },
    ]

    const entries = buildSportsSidebarEntries(rows, 'esports')

    expect(entries.map(entry => entry.type === 'divider'
      ? 'divider'
      : entry.type === 'header'
        ? entry.label
        : entry.label)).toEqual([
      'Live',
      'Upcoming',
      'divider',
      'Games',
      'CS2',
      'LoL',
    ])
    expect(entries).not.toContainEqual(expect.objectContaining({ label: 'Dota 2' }))
    expect(entries).not.toContainEqual(expect.objectContaining({ label: 'Soccer' }))
  })

  it('renders a top-level link sport as a group after adding a nested league', () => {
    const rows: SportsMenuSidebarRow[] = [
      {
        ...buildLinkRow({
          id: 'golf',
          label: 'Golf',
          href: '/sports/golf/props',
          menuSlug: 'golf',
        }),
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
      },
      {
        ...buildLinkRow({
          id: 'pga-tour',
          label: 'PGA Tour',
          href: '/sports/pga-tour/games',
          menuSlug: 'pga-tour',
          parentId: 'golf',
        }),
        sidebar_enabled: true,
        sort_order: 0,
      },
    ]

    expect(findSportsMenuGroup(buildSportsSidebarEntries(rows, 'sports'), 'golf')).toMatchObject({
      type: 'group',
      label: 'Golf',
      href: '/sports/golf/props',
      links: [
        expect.objectContaining({ label: 'All', href: '/sports/golf/props' }),
        expect.objectContaining({ label: 'PGA Tour', href: '/sports/pga-tour/games' }),
      ],
    })
  })

  it('builds the sports sidebar with the exact Polymarket-inspired href order', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({
        id: 'top-link-live-sports-live-0',
        label: 'Live',
        href: '/sports/live',
      }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      buildLinkRow({
        id: 'top-link-nhl-sports-nhl-games-6',
        label: 'NHL',
        href: '/sports/nhl/games',
        menuSlug: 'nhl',
      }),
      buildGroupRow({ id: 'group-ufc-7', label: 'UFC' }),
      ...buildChildLinkRows('group-ufc-7', [
        { label: 'All', href: '/sports/mma/games', menuSlug: 'mma' },
        { label: 'UFC', href: '/sports/ufc/games', menuSlug: 'ufc' },
        { label: 'Power Slap', href: '/sports/powerslap/games', menuSlug: 'powerslap' },
      ]),
      buildGroupRow({ id: 'group-football-9', label: 'Football' }),
      ...buildChildLinkRows('group-football-9', [
        { label: 'All', href: '/sports/football/games', menuSlug: 'football' },
        { label: 'CFL', href: '/sports/cfl/games', menuSlug: 'cfl' },
        { label: 'NFL', href: '/sports/nfl/props', menuSlug: 'nfl' },
        { label: 'CFB', href: '/sports/cfb/props', menuSlug: 'cfb' },
      ]),
      buildGroupRow({ id: 'group-soccer-11', label: 'Soccer' }),
      ...buildChildLinkRows('group-soccer-11', [
        { label: 'All', href: '/sports/soccer/games', menuSlug: 'soccer' },
        { label: 'World Cup', href: '/sports/world-cup/games', menuSlug: 'world-cup' },
        { label: 'Bolivia LFPB', href: '/sports/bol1/games', menuSlug: 'bol1' },
        { label: 'League Two', href: '/sports/el2/games', menuSlug: 'el2' },
        { label: 'MLS', href: '/sports/mls/games', menuSlug: 'mls' },
        { label: 'Norway Eliteserien', href: '/sports/nor/games', menuSlug: 'nor' },
        { label: 'Brazil Série B', href: '/sports/bra2/games', menuSlug: 'bra2' },
        { label: 'Morocco Botola Pro', href: '/sports/mar1/games', menuSlug: 'mar1' },
        { label: 'Colombia Primera A', href: '/sports/col1/games', menuSlug: 'col1' },
        { label: 'Chinese Super League', href: '/sports/csl/games', menuSlug: 'csl' },
        { label: 'Sweden Allsvenskan', href: '/sports/swe/games', menuSlug: 'swe' },
        { label: 'La Liga 2', href: '/sports/es2/games', menuSlug: 'es2' },
        { label: 'OBOS-ligaen', href: '/sports/nor2/games', menuSlug: 'nor2' },
        { label: 'Chile Primera', href: '/sports/chi1/games', menuSlug: 'chi1' },
        { label: 'TFF Süper Kupa', href: '/sports/trsk/games', menuSlug: 'trsk' },
        { label: 'J2 League', href: '/sports/ja2/games', menuSlug: 'ja2' },
        { label: 'Besta deild', href: '/sports/isl1/games', menuSlug: 'isl1' },
      ]),
      buildGroupRow({ id: 'group-tennis-12', label: 'Tennis' }),
      ...buildChildLinkRows('group-tennis-12', [
        { label: 'All', href: '/sports/tennis/games', menuSlug: 'tennis' },
        { label: 'ATP', href: '/sports/atp/games', menuSlug: 'atp' },
        { label: 'WTA', href: '/sports/wta/games', menuSlug: 'wta' },
        { label: 'ITF', href: '/sports/itf/games', menuSlug: 'itf' },
        { label: 'ATP Doubles', href: '/sports/atp-doubles/games', menuSlug: 'atp-doubles' },
        { label: 'WTA Doubles', href: '/sports/wta-doubles/games', menuSlug: 'wta-doubles' },
      ]),
      buildGroupRow({ id: 'top-link-cricket-sports-crint-games-16', label: 'Cricket' }),
      ...buildChildLinkRows('top-link-cricket-sports-crint-games-16', [
        { label: 'All', href: '/sports/cricket/games', menuSlug: 'cricket' },
        { label: 'International', href: '/sports/crint/games', menuSlug: 'crint' },
        { label: 'MLC', href: '/sports/cricmlc/games', menuSlug: 'cricmlc' },
      ]),
      buildGroupRow({ id: 'group-basketball-10', label: 'Basketball' }),
      ...buildChildLinkRows('group-basketball-10', [
        { label: 'All', href: '/sports/basketball/games', menuSlug: 'basketball' },
        { label: 'WNBA', href: '/sports/wnba/games', menuSlug: 'wnba' },
        { label: 'Pro A', href: '/sports/bkfr1/games', menuSlug: 'bkfr1' },
        { label: 'LNB', href: '/sports/bkarg/games', menuSlug: 'bkarg' },
        { label: 'Turkey BSL', href: '/sports/bkbsl/games', menuSlug: 'bkbsl' },
        { label: 'Germany BBL', href: '/sports/bkbbl/games', menuSlug: 'bkbbl' },
        { label: 'Liga Endesa', href: '/sports/bkligend/games', menuSlug: 'bkligend' },
        { label: 'Israel Super League', href: '/sports/bkisrsl/games', menuSlug: 'bkisrsl' },
        { label: 'PLK', href: '/sports/bkplk/games', menuSlug: 'bkplk' },
        { label: 'Serie A', href: '/sports/bkseriea/games', menuSlug: 'bkseriea' },
        { label: 'NBA', href: '/sports/nba/games', menuSlug: 'nba' },
        { label: 'BSN', href: '/sports/bkbsn/games', menuSlug: 'bkbsn' },
      ]),
      buildGroupRow({ id: 'group-baseball-14', label: 'Baseball' }),
      ...buildChildLinkRows('group-baseball-14', [
        { label: 'All', href: '/sports/baseball/games', menuSlug: 'baseball' },
        { label: 'MLB', href: '/sports/mlb/games', menuSlug: 'mlb' },
        { label: 'KBO', href: '/sports/kbo/games', menuSlug: 'kbo' },
      ]),
      buildGroupRow({ id: 'group-hockey-15', label: 'Hockey' }),
      ...buildChildLinkRows('group-hockey-15', [
        { label: 'All', href: '/sports/hockey/games', menuSlug: 'hockey' },
        { label: 'American Hockey League', href: '/sports/ahl/games', menuSlug: 'ahl' },
        { label: 'NHL', href: '/sports/nhl/games', menuSlug: 'nhl' },
      ]),
      buildGroupRow({ id: 'group-rugby-17', label: 'Rugby' }),
      ...buildChildLinkRows('group-rugby-17', [
        { label: 'All', href: '/sports/rugby/games', menuSlug: 'rugby' },
        { label: 'Top 14', href: '/sports/rutopft/games', menuSlug: 'rutopft' },
        { label: 'Super Rugby Pacific', href: '/sports/rusrp/games', menuSlug: 'rusrp' },
        { label: 'Premiership Rugby', href: '/sports/ruprem/games', menuSlug: 'ruprem' },
        { label: 'United Rugby Championship', href: '/sports/ruurc/games', menuSlug: 'ruurc' },
      ]),
      buildGroupRow({ id: 'group-table-tennis-18', label: 'Table Tennis' }),
      ...buildChildLinkRows('group-table-tennis-18', [
        { label: 'All', href: '/sports/table-tennis/games', menuSlug: 'table-tennis' },
        { label: 'WTT Men', href: '/sports/wtt-mens-singles/games', menuSlug: 'wtt-mens-singles' },
        { label: 'WTT Women', href: '/sports/wtt-womens-singles/games', menuSlug: 'wtt-womens-singles' },
      ]),
      buildLinkRow({
        id: 'top-link-golf',
        label: 'Golf',
        href: '/sports/golf/props',
        menuSlug: 'golf',
      }),
      buildLinkRow({
        id: 'top-link-f1',
        label: 'Formula 1',
        href: '/sports/f1/props',
        menuSlug: 'f1',
      }),
      buildLinkRow({
        id: 'top-link-boxing',
        label: 'Boxing',
        href: '/sports/boxing/props',
        menuSlug: 'boxing',
      }),
      buildLinkRow({
        id: 'top-link-pickleball',
        label: 'Pickleball',
        href: '/sports/pickleball/games',
        menuSlug: 'pickleball',
      }),
      buildGroupRow({ id: 'group-lacrosse-24', label: 'Lacrosse' }),
      ...buildChildLinkRows('group-lacrosse-24', [
        { label: 'All', href: '/sports/lacrosse/games', menuSlug: 'lacrosse' },
        { label: 'WLL', href: '/sports/wll/games', menuSlug: 'wll' },
        { label: 'PLL', href: '/sports/pll/games', menuSlug: 'pll' },
      ]),
      buildLinkRow({
        id: 'sports-top-link-esports',
        label: 'Esports',
        href: '/esports',
        menuSlug: null,
      }),
    ]

    const entries = buildSportsSidebarEntries(rows, 'sports')

    expect(entries).toContainEqual({
      type: 'header',
      id: 'sports-header',
      label: 'All Sports',
    })
    expect(flattenMenuHrefs(entries)).toEqual([
      '/sports/live',
      '/sports/soon',
      '/sports/world-cup/games',
      '/sports/mlb/games',
      '/sports/nhl/games',
      '/sports/mma/games',
      '/sports/mma/games',
      '/sports/ufc/games',
      '/sports/powerslap/games',
      '/sports/football/games',
      '/sports/football/games',
      '/sports/cfl/games',
      '/sports/nfl/props',
      '/sports/cfb/props',
      '/sports/soccer/games',
      '/sports/soccer/games',
      '/sports/world-cup/games',
      '/sports/bol1/games',
      '/sports/el2/games',
      '/sports/mls/games',
      '/sports/nor/games',
      '/sports/bra2/games',
      '/sports/mar1/games',
      '/sports/col1/games',
      '/sports/csl/games',
      '/sports/swe/games',
      '/sports/es2/games',
      '/sports/nor2/games',
      '/sports/chi1/games',
      '/sports/trsk/games',
      '/sports/ja2/games',
      '/sports/isl1/games',
      '/sports/tennis/games',
      '/sports/tennis/games',
      '/sports/atp/games',
      '/sports/wta/games',
      '/sports/itf/games',
      '/sports/atp-doubles/games',
      '/sports/wta-doubles/games',
      '/sports/cricket/games',
      '/sports/cricket/games',
      '/sports/crint/games',
      '/sports/cricmlc/games',
      '/sports/basketball/games',
      '/sports/basketball/games',
      '/sports/wnba/games',
      '/sports/bkfr1/games',
      '/sports/bkarg/games',
      '/sports/bkbsl/games',
      '/sports/bkbbl/games',
      '/sports/bkligend/games',
      '/sports/bkisrsl/games',
      '/sports/bkplk/games',
      '/sports/bkseriea/games',
      '/sports/nba/games',
      '/sports/bkbsn/games',
      '/sports/baseball/games',
      '/sports/baseball/games',
      '/sports/mlb/games',
      '/sports/kbo/games',
      '/sports/hockey/games',
      '/sports/hockey/games',
      '/sports/ahl/games',
      '/sports/nhl/games',
      '/sports/rugby/games',
      '/sports/rugby/games',
      '/sports/rutopft/games',
      '/sports/rusrp/games',
      '/sports/ruprem/games',
      '/sports/ruurc/games',
      '/sports/table-tennis/games',
      '/sports/table-tennis/games',
      '/sports/wtt-mens-singles/games',
      '/sports/wtt-womens-singles/games',
      '/sports/golf/props',
      '/sports/f1/props',
      '/sports/boxing/props',
      '/sports/pickleball/games',
      '/sports/lacrosse/games',
      '/sports/lacrosse/games',
      '/sports/wll/games',
      '/sports/pll/games',
      '/esports',
    ])

    const baseballGroup = findSportsMenuGroup(entries, 'baseball')
    expect(baseballGroup).toMatchObject({
      type: 'group',
      label: 'Baseball',
    })
  })

  it('orders soccer child links like the html spec and omits non-spec items', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildGroupRow({ id: 'group-soccer-11', label: 'Soccer' }),
      ...buildChildLinkRows('group-soccer-11', [
        { label: 'All', href: '/sports/soccer/games', menuSlug: 'soccer' },
        { label: 'World Cup', href: '/sports/world-cup/games', menuSlug: 'world-cup' },
        { label: 'Bolivia LFPB', href: '/sports/bol1/games', menuSlug: 'bol1' },
        { label: 'League Two', href: '/sports/el2/games', menuSlug: 'el2' },
        { label: 'MLS', href: '/sports/mls/games', menuSlug: 'mls' },
        { label: 'Norway Eliteserien', href: '/sports/nor/games', menuSlug: 'nor' },
        { label: 'Brazil Série B', href: '/sports/bra2/games', menuSlug: 'bra2' },
        { label: 'Morocco Botola Pro', href: '/sports/mar1/games', menuSlug: 'mar1' },
        { label: 'Colombia Primera A', href: '/sports/col1/games', menuSlug: 'col1' },
        { label: 'Chinese Super League', href: '/sports/csl/games', menuSlug: 'csl' },
        { label: 'Sweden Allsvenskan', href: '/sports/swe/games', menuSlug: 'swe' },
        { label: 'La Liga 2', href: '/sports/es2/games', menuSlug: 'es2' },
        { label: 'OBOS-ligaen', href: '/sports/nor2/games', menuSlug: 'nor2' },
        { label: 'Chile Primera', href: '/sports/chi1/games', menuSlug: 'chi1' },
        { label: 'TFF Süper Kupa', href: '/sports/trsk/games', menuSlug: 'trsk' },
        { label: 'J2 League', href: '/sports/ja2/games', menuSlug: 'ja2' },
        { label: 'Besta deild', href: '/sports/isl1/games', menuSlug: 'isl1' },
        { label: 'Europe WC Qualifiers', href: '/sports/uef-qualifiers/games', menuSlug: 'uef-qualifiers' },
        { label: 'FIFA Friendlies', href: '/sports/fifa-friendlies/games', menuSlug: 'fifa-friendlies' },
        { label: 'La Liga', href: '/sports/laliga/games', menuSlug: 'laliga' },
        { label: 'UCL', href: '/sports/ucl/games', menuSlug: 'ucl' },
        { label: 'EPL', href: '/sports/epl/games', menuSlug: 'epl' },
        { label: 'Ligue 1', href: '/sports/ligue-1/games', menuSlug: 'ligue-1' },
      ]),
      buildLinkRow({
        id: 'group-soccer-11-link-uwcl',
        label: 'Women Champions League',
        href: '/sports/uwcl/games',
        menuSlug: 'uwcl',
        parentId: 'group-soccer-11',
      }),
    ]

    const soccerGroup = findSportsMenuGroup(buildSportsSidebarEntries(rows, 'sports'), 'soccer')

    expect(soccerGroup).toMatchObject({
      type: 'group',
      href: '/sports/soccer/games',
    })
    expect(soccerGroup?.links.map(link => link.href)).toEqual([
      '/sports/soccer/games',
      '/sports/world-cup/games',
      '/sports/bol1/games',
      '/sports/el2/games',
      '/sports/mls/games',
      '/sports/nor/games',
      '/sports/bra2/games',
      '/sports/mar1/games',
      '/sports/col1/games',
      '/sports/csl/games',
      '/sports/swe/games',
      '/sports/es2/games',
      '/sports/nor2/games',
      '/sports/chi1/games',
      '/sports/trsk/games',
      '/sports/ja2/games',
      '/sports/isl1/games',
    ])
  })

  it('uses the spec child ordering for basketball and cricket, including newly-seeded slugs', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildGroupRow({ id: 'group-basketball-10', label: 'Basketball' }),
      ...buildChildLinkRows('group-basketball-10', [
        { label: 'All', href: '/sports/basketball/games', menuSlug: 'basketball' },
        { label: 'WNBA', href: '/sports/wnba/games', menuSlug: 'wnba' },
        { label: 'Pro A', href: '/sports/bkfr1/games', menuSlug: 'bkfr1' },
        { label: 'LNB', href: '/sports/bkarg/games', menuSlug: 'bkarg' },
        { label: 'Turkey BSL', href: '/sports/bkbsl/games', menuSlug: 'bkbsl' },
        { label: 'Germany BBL', href: '/sports/bkbbl/games', menuSlug: 'bkbbl' },
        { label: 'Liga Endesa', href: '/sports/bkligend/games', menuSlug: 'bkligend' },
        { label: 'Israel Super League', href: '/sports/bkisrsl/games', menuSlug: 'bkisrsl' },
        { label: 'PLK', href: '/sports/bkplk/games', menuSlug: 'bkplk' },
        { label: 'Serie A', href: '/sports/bkseriea/games', menuSlug: 'bkseriea' },
        { label: 'NBA', href: '/sports/nba/games', menuSlug: 'nba' },
        { label: 'BSN', href: '/sports/bkbsn/games', menuSlug: 'bkbsn' },
        { label: 'NCAAB', href: '/sports/cbb/games', menuSlug: 'cbb' },
        { label: 'Champions League', href: '/sports/bkcl/games', menuSlug: 'bkcl' },
        { label: 'CWBB', href: '/sports/cwbb/games', menuSlug: 'cwbb' },
        { label: 'Euroleague Basketball', href: '/sports/euroleague/games', menuSlug: 'euroleague' },
        { label: 'CBA', href: '/sports/bkcba/games', menuSlug: 'bkcba' },
        { label: 'KBL', href: '/sports/bkkbl/games', menuSlug: 'bkkbl' },
        { label: 'NBL', href: '/sports/bknbl/games', menuSlug: 'bknbl' },
      ]),
      buildGroupRow({ id: 'top-link-cricket-sports-crint-games-16', label: 'Cricket' }),
      ...buildChildLinkRows('top-link-cricket-sports-crint-games-16', [
        { label: 'All', href: '/sports/cricket/games', menuSlug: 'cricket' },
        { label: 'International', href: '/sports/crint/games', menuSlug: 'crint' },
        { label: 'MLC', href: '/sports/cricmlc/games', menuSlug: 'cricmlc' },
        { label: 'IPL', href: '/sports/cricipl/games', menuSlug: 'cricipl' },
        { label: 'PSL', href: '/sports/cricpsl/games', menuSlug: 'cricpsl' },
        { label: 'Legends', href: '/sports/criclcl/games', menuSlug: 'criclcl' },
        { label: 'National T20 Cup', href: '/sports/cricpakt20cup/games', menuSlug: 'cricpakt20cup' },
        { label: 'Big Bash League', href: '/sports/cricbbl/games', menuSlug: 'cricbbl' },
      ]),
    ]

    const entries = buildSportsSidebarEntries(rows, 'sports')
    const cricketGroup = findSportsMenuGroup(entries, 'cricket')
    const basketballGroup = findSportsMenuGroup(entries, 'basketball')

    expect(cricketGroup).toMatchObject({
      type: 'group',
      href: '/sports/cricket/games',
    })
    expect(cricketGroup?.links.map(link => link.href)).toEqual([
      '/sports/cricket/games',
      '/sports/crint/games',
      '/sports/cricmlc/games',
    ])

    expect(basketballGroup).toMatchObject({
      type: 'group',
      href: '/sports/basketball/games',
    })
    expect(basketballGroup?.links.map(link => link.href)).toEqual([
      '/sports/basketball/games',
      '/sports/wnba/games',
      '/sports/bkfr1/games',
      '/sports/bkarg/games',
      '/sports/bkbsl/games',
      '/sports/bkbbl/games',
      '/sports/bkligend/games',
      '/sports/bkisrsl/games',
      '/sports/bkplk/games',
      '/sports/bkseriea/games',
      '/sports/nba/games',
      '/sports/bkbsn/games',
    ])
  })

  it('builds the esports sidebar with the exact Polymarket-inspired href order', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({
        id: 'top-link-live-sports-live-0',
        label: 'Live',
        href: '/sports/live',
      }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      buildGroupRow({ id: 'group-esports-league-of-legends', label: 'LoL' }),
      ...buildEsportsChildLinkRows('group-esports-league-of-legends', [
        { label: 'Games', href: '/esports/league-of-legends/games', slug: 'games' },
        { label: 'Props', href: '/esports/league-of-legends/props', slug: 'props' },
        { label: 'Asia Masters', href: '/esports/league-of-legends/asia-masters', slug: 'asia-masters' },
        {
          label: 'Mid-Season Invitational',
          href: '/esports/league-of-legends/mid-season-invitational',
          slug: 'mid-season-invitational',
        },
      ]),
      buildGroupRow({ id: 'group-esports-cs2', label: 'CS2' }),
      ...buildEsportsChildLinkRows('group-esports-cs2', [
        { label: 'Games', href: '/esports/cs2/games', slug: 'games' },
        { label: 'Props', href: '/esports/cs2/props', slug: 'props' },
        { label: 'CCT Europe', href: '/esports/cs2/cct-europe', slug: 'cct-europe' },
        { label: 'Dust2.dk Ligaen', href: '/esports/cs2/dust2-dk-ligaen', slug: 'dust2-dk-ligaen' },
        { label: 'European Pro League', href: '/esports/cs2/european-pro-league', slug: 'european-pro-league' },
        {
          label: 'Gamers Club Liga Série A',
          href: '/esports/cs2/gamers-club-liga-s-rie-a',
          slug: 'gamers-club-liga-serie-a',
        },
        { label: 'IEM', href: '/esports/cs2/iem', slug: 'iem' },
        { label: 'NODWIN Clutch Series', href: '/esports/cs2/nodwin-clutch-series', slug: 'nodwin-clutch-series' },
        { label: 'United21', href: '/esports/cs2/united21', slug: 'united21' },
        { label: 'XSE Pro League', href: '/esports/cs2/xse-pro-league', slug: 'xse-pro-league' },
      ]),
      buildGroupRow({ id: 'group-esports-dota-2', label: 'Dota 2' }),
      ...buildEsportsChildLinkRows('group-esports-dota-2', [
        { label: 'Games', href: '/esports/dota-2/games', slug: 'games' },
        { label: 'Props', href: '/esports/dota-2/props', slug: 'props' },
        { label: 'European Pro League', href: '/esports/dota-2/european-pro-league', slug: 'european-pro-league' },
        { label: 'The International', href: '/esports/dota-2/the-international', slug: 'the-international' },
      ]),
      buildGroupRow({ id: 'group-esports-valorant', label: 'Valorant' }),
      ...buildEsportsChildLinkRows('group-esports-valorant', [
        { label: 'Games', href: '/esports/valorant/games', slug: 'games' },
        { label: 'Props', href: '/esports/valorant/props', slug: 'props' },
        { label: 'VCL', href: '/esports/valorant/vcl', slug: 'vcl' },
        { label: 'VCT', href: '/esports/valorant/vct', slug: 'vct' },
      ]),
      buildGroupRow({ id: 'group-esports-mobile-legends-bang-bang', label: 'Mobile Legends: Bang Bang' }),
      ...buildEsportsChildLinkRows('group-esports-mobile-legends-bang-bang', [
        { label: 'Games', href: '/esports/mobile-legends-bang-bang/games', slug: 'games' },
        { label: 'Props', href: '/esports/mobile-legends-bang-bang/props', slug: 'props' },
        {
          label: 'BetBoom Rise of Legends',
          href: '/esports/mobile-legends-bang-bang/betboom-rise-of-legends',
          slug: 'betboom-rise-of-legends',
        },
      ]),
      buildGroupRow({ id: 'group-esports-overwatch', label: 'Overwatch' }),
      ...buildEsportsChildLinkRows('group-esports-overwatch', [
        { label: 'Games', href: '/esports/overwatch/games', slug: 'games' },
        { label: 'Props', href: '/esports/overwatch/props', slug: 'props' },
        { label: 'OCS', href: '/esports/overwatch/ocs', slug: 'ocs' },
      ]),
      buildGroupRow({ id: 'group-esports-rainbow-six-siege', label: 'Rainbow Six Siege' }),
      ...buildEsportsChildLinkRows('group-esports-rainbow-six-siege', [
        { label: 'Games', href: '/esports/rainbow-six-siege/games', slug: 'games' },
        { label: 'Props', href: '/esports/rainbow-six-siege/props', slug: 'props' },
        {
          label: 'Asia Pacific League',
          href: '/esports/rainbow-six-siege/asia-pacific-league',
          slug: 'asia-pacific-league',
        },
        { label: 'CN League', href: '/esports/rainbow-six-siege/cn-league', slug: 'cn-league' },
        {
          label: 'North America League',
          href: '/esports/rainbow-six-siege/north-america-league',
          slug: 'north-america-league',
        },
        {
          label: 'South America League',
          href: '/esports/rainbow-six-siege/south-america-league',
          slug: 'south-america-league',
        },
      ]),
      buildGroupRow({ id: 'group-esports-call-of-duty', label: 'Call of Duty' }),
      ...buildEsportsChildLinkRows('group-esports-call-of-duty', [
        { label: 'Games', href: '/esports/call-of-duty/games', slug: 'games' },
        { label: 'Props', href: '/esports/call-of-duty/props', slug: 'props' },
        {
          label: 'Call of Duty League',
          href: '/esports/call-of-duty/call-of-duty-league',
          slug: 'call-of-duty-league',
        },
      ]),
      buildLinkRow({
        id: 'group-esports-13-link-starcraft-2',
        label: 'StarCraft II',
        href: '/sports/starcraft-2/games',
        menuSlug: 'starcraft-2',
      }),
      buildGroupRow({ id: 'group-esports-honor-of-kings', label: 'Honor of Kings' }),
      ...buildEsportsChildLinkRows('group-esports-honor-of-kings', [
        { label: 'Games', href: '/esports/honor-of-kings/games', slug: 'games' },
        { label: 'Props', href: '/esports/honor-of-kings/props', slug: 'props' },
        {
          label: 'Arena of Valor Premier League',
          href: '/esports/honor-of-kings/arena-of-valor-premier-league',
          slug: 'arena-of-valor-premier-league',
        },
        { label: 'King Pro League', href: '/esports/honor-of-kings/king-pro-league', slug: 'king-pro-league' },
      ]),
      buildLinkRow({
        id: 'group-esports-13-link-rocket-league',
        label: 'Rocket League',
        href: '/sports/rocket-league/games',
        menuSlug: 'rocket-league',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-starcraft-brood-war',
        label: 'StarCraft: Brood War',
        href: '/sports/starcraft-brood-war/props',
        menuSlug: 'starcraft-brood-war',
      }),
    ]

    const entries = buildSportsSidebarEntries(rows, 'esports')

    expect(entries).toContainEqual({
      type: 'header',
      id: 'esports-header',
      label: 'Games',
    })
    expect(flattenMenuHrefs(entries)).toEqual([
      '/esports/live',
      '/esports/soon',
      '/esports/league-of-legends/games',
      '/esports/league-of-legends/games',
      '/esports/league-of-legends/props',
      '/esports/league-of-legends/asia-masters',
      '/esports/league-of-legends/mid-season-invitational',
      '/esports/cs2/games',
      '/esports/cs2/games',
      '/esports/cs2/props',
      '/esports/cs2/cct-europe',
      '/esports/cs2/dust2-dk-ligaen',
      '/esports/cs2/european-pro-league',
      '/esports/cs2/gamers-club-liga-s-rie-a',
      '/esports/cs2/iem',
      '/esports/cs2/nodwin-clutch-series',
      '/esports/cs2/united21',
      '/esports/cs2/xse-pro-league',
      '/esports/dota-2/games',
      '/esports/dota-2/games',
      '/esports/dota-2/props',
      '/esports/dota-2/european-pro-league',
      '/esports/dota-2/the-international',
      '/esports/valorant/games',
      '/esports/valorant/games',
      '/esports/valorant/props',
      '/esports/valorant/vcl',
      '/esports/valorant/vct',
      '/esports/mobile-legends-bang-bang/games',
      '/esports/mobile-legends-bang-bang/games',
      '/esports/mobile-legends-bang-bang/props',
      '/esports/mobile-legends-bang-bang/betboom-rise-of-legends',
      '/esports/overwatch/games',
      '/esports/overwatch/games',
      '/esports/overwatch/props',
      '/esports/overwatch/ocs',
      '/esports/rainbow-six-siege/games',
      '/esports/rainbow-six-siege/games',
      '/esports/rainbow-six-siege/props',
      '/esports/rainbow-six-siege/asia-pacific-league',
      '/esports/rainbow-six-siege/cn-league',
      '/esports/rainbow-six-siege/north-america-league',
      '/esports/rainbow-six-siege/south-america-league',
      '/esports/call-of-duty/games',
      '/esports/call-of-duty/games',
      '/esports/call-of-duty/props',
      '/esports/call-of-duty/call-of-duty-league',
      '/esports/starcraft-2/games',
      '/esports/honor-of-kings/games',
      '/esports/honor-of-kings/games',
      '/esports/honor-of-kings/props',
      '/esports/honor-of-kings/arena-of-valor-premier-league',
      '/esports/honor-of-kings/king-pro-league',
      '/esports/rocket-league/games',
      '/esports/starcraft-brood-war/props',
    ])
  })

  it('renders explicit esports props links when the backing database rows are absent', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildGroupRow({ id: 'group-esports-league-of-legends', label: 'LoL' }),
      ...buildEsportsChildLinkRows('group-esports-league-of-legends', [
        { label: 'Games', href: '/esports/league-of-legends/games', slug: 'games' },
        { label: 'Asia Masters', href: '/esports/league-of-legends/asia-masters', slug: 'asia-masters' },
      ]),
      buildGroupRow({ id: 'group-esports-cs2', label: 'CS2' }),
      ...buildEsportsChildLinkRows('group-esports-cs2', [
        { label: 'Games', href: '/esports/cs2/games', slug: 'games' },
        { label: 'IEM', href: '/esports/cs2/iem', slug: 'iem' },
      ]),
      buildGroupRow({ id: 'group-esports-dota-2', label: 'Dota 2' }),
      ...buildEsportsChildLinkRows('group-esports-dota-2', [
        { label: 'Games', href: '/esports/dota-2/games', slug: 'games' },
        { label: 'European Pro League', href: '/esports/dota-2/european-pro-league', slug: 'european-pro-league' },
        { label: 'The International', href: '/esports/dota-2/the-international', slug: 'the-international' },
      ]),
      buildGroupRow({ id: 'group-esports-valorant', label: 'Valorant' }),
      ...buildEsportsChildLinkRows('group-esports-valorant', [
        { label: 'Games', href: '/esports/valorant/games', slug: 'games' },
        { label: 'VCT', href: '/esports/valorant/vct', slug: 'vct' },
      ]),
      buildGroupRow({ id: 'group-esports-mobile-legends-bang-bang', label: 'Mobile Legends: Bang Bang' }),
      ...buildEsportsChildLinkRows('group-esports-mobile-legends-bang-bang', [
        { label: 'Games', href: '/esports/mobile-legends-bang-bang/games', slug: 'games' },
        {
          label: 'BetBoom Rise of Legends',
          href: '/esports/mobile-legends-bang-bang/betboom-rise-of-legends',
          slug: 'betboom-rise-of-legends',
        },
      ]),
      buildGroupRow({ id: 'group-esports-overwatch', label: 'Overwatch' }),
      ...buildEsportsChildLinkRows('group-esports-overwatch', [
        { label: 'Games', href: '/esports/overwatch/games', slug: 'games' },
        { label: 'OCS', href: '/esports/overwatch/ocs', slug: 'ocs' },
      ]),
      buildGroupRow({ id: 'group-esports-rainbow-six-siege', label: 'Rainbow Six Siege' }),
      ...buildEsportsChildLinkRows('group-esports-rainbow-six-siege', [
        { label: 'Games', href: '/esports/rainbow-six-siege/games', slug: 'games' },
        {
          label: 'Asia Pacific League',
          href: '/esports/rainbow-six-siege/asia-pacific-league',
          slug: 'asia-pacific-league',
        },
      ]),
      buildGroupRow({ id: 'group-esports-call-of-duty', label: 'Call of Duty' }),
      ...buildEsportsChildLinkRows('group-esports-call-of-duty', [
        { label: 'Games', href: '/esports/call-of-duty/games', slug: 'games' },
        {
          label: 'Call of Duty League',
          href: '/esports/call-of-duty/call-of-duty-league',
          slug: 'call-of-duty-league',
        },
      ]),
      buildGroupRow({ id: 'group-esports-honor-of-kings', label: 'Honor of Kings' }),
      ...buildEsportsChildLinkRows('group-esports-honor-of-kings', [
        { label: 'Games', href: '/esports/honor-of-kings/games', slug: 'games' },
        { label: 'King Pro League', href: '/esports/honor-of-kings/king-pro-league', slug: 'king-pro-league' },
      ]),
    ]

    const entries = buildSportsSidebarEntries(rows, 'esports')

    expect(findSportsMenuGroup(entries, 'league-of-legends')?.links.map(link => link.href)).toEqual([
      '/esports/league-of-legends/games',
      '/esports/league-of-legends/props',
      '/esports/league-of-legends/asia-masters',
    ])
    expect(findSportsMenuGroup(entries, 'counter-strike')?.links.map(link => link.href)).toEqual([
      '/esports/cs2/games',
      '/esports/cs2/props',
      '/esports/cs2/iem',
    ])
    expect(findSportsMenuGroup(entries, 'dota-2')?.links.map(link => link.href)).toEqual([
      '/esports/dota-2/games',
      '/esports/dota-2/props',
      '/esports/dota-2/european-pro-league',
      '/esports/dota-2/the-international',
    ])
    expect(findSportsMenuGroup(entries, 'valorant')?.links.map(link => link.href)).toEqual([
      '/esports/valorant/games',
      '/esports/valorant/props',
      '/esports/valorant/vct',
    ])
    expect(findSportsMenuGroup(entries, 'mobile-legends-bang-bang')?.links.map(link => link.href)).toEqual([
      '/esports/mobile-legends-bang-bang/games',
      '/esports/mobile-legends-bang-bang/props',
      '/esports/mobile-legends-bang-bang/betboom-rise-of-legends',
    ])
    expect(findSportsMenuGroup(entries, 'overwatch')?.links.map(link => link.href)).toEqual([
      '/esports/overwatch/games',
      '/esports/overwatch/props',
      '/esports/overwatch/ocs',
    ])
    expect(findSportsMenuGroup(entries, 'rainbow-six-siege')?.links.map(link => link.href)).toEqual([
      '/esports/rainbow-six-siege/games',
      '/esports/rainbow-six-siege/props',
      '/esports/rainbow-six-siege/asia-pacific-league',
    ])
    expect(findSportsMenuGroup(entries, 'call-of-duty')?.links.map(link => link.href)).toEqual([
      '/esports/call-of-duty/games',
      '/esports/call-of-duty/props',
      '/esports/call-of-duty/call-of-duty-league',
    ])
    expect(findSportsMenuGroup(entries, 'honor-of-kings')?.links.map(link => link.href)).toEqual([
      '/esports/honor-of-kings/games',
      '/esports/honor-of-kings/props',
      '/esports/honor-of-kings/king-pro-league',
    ])
  })
})
