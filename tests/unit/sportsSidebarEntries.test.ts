import type { SportsMenuSidebarRow } from '@/lib/sports-sidebar-entries'
import { describe, expect, it } from 'vitest'
import {
  buildSportsSidebarEntries,

} from '@/lib/sports-sidebar-entries'

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

function buildHeaderRow(id: string, label: string): SportsMenuSidebarRow {
  return {
    id,
    item_type: 'header',
    label,
    href: null,
    icon_url: null,
    parent_id: null,
    menu_slug: null,
  }
}

function buildDividerRow(id: string): SportsMenuSidebarRow {
  return {
    id,
    item_type: 'divider',
    label: null,
    href: null,
    icon_url: null,
    parent_id: null,
    menu_slug: null,
  }
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
  it('builds the sports live sidebar root href structure from the html spec', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({ id: 'top-link-live-sports-live-0', label: 'Live', href: '/sports/live' }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      buildDividerRow('divider-2'),
      buildHeaderRow('header-3', 'All Sports'),
      buildLinkRow({
        id: 'top-link-nba-sports-nba-games-4',
        label: 'NBA',
        href: '/sports/nba/games',
        menuSlug: 'nba',
      }),
      buildLinkRow({
        id: 'top-link-ncaab-sports-cbb-games-5',
        label: 'NCAAB',
        href: '/sports/cbb/games',
        menuSlug: 'cbb',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-ucl',
        label: 'UCL',
        href: '/sports/ucl/games',
        menuSlug: 'ucl',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'top-link-nhl-sports-nhl-games-6',
        label: 'NHL',
        href: '/sports/nhl/games',
        menuSlug: 'nhl',
      }),
      buildGroupRow({ id: 'group-ufc-7', label: 'UFC' }),
      buildLinkRow({
        id: 'group-ufc-7-link-ufc',
        label: 'UFC',
        href: '/sports/ufc/games',
        menuSlug: 'ufc',
        parentId: 'group-ufc-7',
      }),
      buildLinkRow({
        id: 'group-ufc-7-link-zuffa',
        label: 'Zuffa',
        href: '/sports/zuffa/games',
        menuSlug: 'zuffa',
        parentId: 'group-ufc-7',
      }),
      buildGroupRow({ id: 'group-football-9', label: 'Football' }),
      buildLinkRow({
        id: 'group-football-9-link-nfl',
        label: 'NFL',
        href: '/sports/nfl/props',
        menuSlug: 'nfl',
        parentId: 'group-football-9',
      }),
      buildLinkRow({
        id: 'group-football-9-link-cfb',
        label: 'CFB',
        href: '/sports/cfb/props',
        menuSlug: 'cfb',
        parentId: 'group-football-9',
      }),
      buildGroupRow({ id: 'group-baseball-14', label: 'Baseball' }),
      buildLinkRow({
        id: 'group-baseball-14-link-mlb',
        label: 'MLB',
        href: '/sports/mlb/games',
        menuSlug: 'mlb',
        parentId: 'group-baseball-14',
      }),
      buildLinkRow({
        id: 'group-baseball-14-link-kbo',
        label: 'KBO',
        href: '/sports/kbo/games',
        menuSlug: 'kbo',
        parentId: 'group-baseball-14',
      }),
      buildGroupRow({ id: 'group-table-tennis-18', label: 'Table Tennis' }),
      buildLinkRow({
        id: 'group-table-tennis-18-link-wtt-men',
        label: 'WTT Men',
        href: '/sports/wtt-mens-singles/games',
        menuSlug: 'wtt-mens-singles',
        parentId: 'group-table-tennis-18',
      }),
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
        id: 'top-link-chess',
        label: 'Chess',
        href: '/sports/chess/props',
        menuSlug: 'chess',
      }),
      buildLinkRow({
        id: 'top-link-boxing',
        label: 'Boxing',
        href: '/sports/boxing/props',
        menuSlug: 'boxing',
      }),
    ]

    expect(flattenMenuHrefs(buildSportsSidebarEntries(rows, 'sports'))).toEqual([
      '/sports/live',
      '/sports/soon',
      '/sports/futures/nba',
      '/sports/nba/games',
      '/sports/cbb/games',
      '/sports/ucl/games',
      '/sports/nhl/games',
      '/sports/ufc/props',
      '/sports/ufc/games',
      '/sports/zuffa/games',
      '/sports/football/props',
      '/sports/nfl/props',
      '/sports/cfb/props',
      '/sports/mlb/games',
      '/sports/wtt-mens-singles/games',
      '/sports/golf/props',
      '/sports/f1/props',
      '/sports/chess/games',
      '/sports/boxing/props',
    ])

    const baseballLink = buildSportsSidebarEntries(rows, 'sports').find(entry =>
      entry.type === 'link' && entry.href === '/sports/mlb/games',
    )
    expect(baseballLink).toMatchObject({
      type: 'link',
      label: 'Baseball',
    })
  })

  it('orders soccer child links like the html spec and omits non-spec items', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildGroupRow({ id: 'group-soccer-11', label: 'Soccer' }),
      buildLinkRow({
        id: 'group-soccer-11-link-epl',
        label: 'EPL',
        href: '/sports/epl/games',
        menuSlug: 'epl',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-ligue-1',
        label: 'Ligue 1',
        href: '/sports/ligue-1/games',
        menuSlug: 'ligue-1',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-ucl',
        label: 'UCL',
        href: '/sports/ucl/games',
        menuSlug: 'ucl',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-fifa-friendlies',
        label: 'FIFA Friendlies',
        href: '/sports/fifa-friendlies/games',
        menuSlug: 'fifa-friendlies',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-uef-qualifiers',
        label: 'Europe WC Qualifiers',
        href: '/sports/uef-qualifiers/games',
        menuSlug: 'uef-qualifiers',
        parentId: 'group-soccer-11',
      }),
      buildLinkRow({
        id: 'group-soccer-11-link-uwcl',
        label: 'Women Champions League',
        href: '/sports/uwcl/games',
        menuSlug: 'uwcl',
        parentId: 'group-soccer-11',
      }),
    ]

    const soccerGroup = buildSportsSidebarEntries(rows, 'sports').find(
      entry => entry.type === 'group' && entry.menuSlug === 'soccer',
    )

    expect(soccerGroup).toMatchObject({
      type: 'group',
      href: '/sports/soccer/games',
    })
    expect(soccerGroup?.links.map(link => link.href)).toEqual([
      '/sports/uef-qualifiers/games',
      '/sports/fifa-friendlies/games',
      '/sports/ucl/games',
      '/sports/epl/games',
      '/sports/ligue-1/games',
    ])
  })

  it('uses the spec child ordering for basketball and cricket, including newly-seeded slugs', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildGroupRow({ id: 'group-basketball-10', label: 'Basketball' }),
      buildLinkRow({
        id: 'group-basketball-10-link-nba',
        label: 'NBA',
        href: '/sports/nba/games',
        menuSlug: 'nba',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-cbb',
        label: 'NCAAB',
        href: '/sports/cbb/games',
        menuSlug: 'cbb',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-bkcl',
        label: 'Champions League',
        href: '/sports/bkcl/games',
        menuSlug: 'bkcl',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-cwbb',
        label: 'CWBB',
        href: '/sports/cwbb/games',
        menuSlug: 'cwbb',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-euroleague',
        label: 'Euroleague Basketball',
        href: '/sports/euroleague/games',
        menuSlug: 'euroleague',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-bkcba',
        label: 'CBA',
        href: '/sports/bkcba/games',
        menuSlug: 'bkcba',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-bknbl',
        label: 'NBL',
        href: '/sports/bknbl/games',
        menuSlug: 'bknbl',
        parentId: 'group-basketball-10',
      }),
      buildLinkRow({
        id: 'group-basketball-10-link-bkfr1',
        label: 'Pro A',
        href: '/sports/bkfr1/games',
        menuSlug: 'bkfr1',
        parentId: 'group-basketball-10',
      }),
      buildGroupRow({ id: 'top-link-cricket-sports-crint-games-16', label: 'Cricket' }),
      buildLinkRow({
        id: 'group-cricket-16-link-cricipl',
        label: 'IPL',
        href: '/sports/cricipl/games',
        menuSlug: 'cricipl',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
      buildLinkRow({
        id: 'group-cricket-16-link-crint',
        label: 'International',
        href: '/sports/crint/games',
        menuSlug: 'crint',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
      buildLinkRow({
        id: 'group-cricket-16-link-cricpsl',
        label: 'PSL',
        href: '/sports/cricpsl/games',
        menuSlug: 'cricpsl',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
      buildLinkRow({
        id: 'group-cricket-16-link-criclcl',
        label: 'Legends',
        href: '/sports/criclcl/games',
        menuSlug: 'criclcl',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
      buildLinkRow({
        id: 'group-cricket-16-link-cricpakt20cup',
        label: 'National T20 Cup',
        href: '/sports/cricpakt20cup/games',
        menuSlug: 'cricpakt20cup',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
      buildLinkRow({
        id: 'group-cricket-16-link-cricbbl',
        label: 'Big Bash League',
        href: '/sports/cricbbl/games',
        menuSlug: 'cricbbl',
        parentId: 'top-link-cricket-sports-crint-games-16',
      }),
    ]

    const entries = buildSportsSidebarEntries(rows, 'sports')
    const cricketGroup = entries.find(entry => entry.type === 'group' && entry.menuSlug === 'cricket')
    const basketballGroup = entries.find(entry => entry.type === 'group' && entry.menuSlug === 'basketball')

    expect(cricketGroup).toMatchObject({
      type: 'group',
      href: '/sports/cricket/games',
    })
    expect(cricketGroup?.links.map(link => link.href)).toEqual([
      '/sports/cricipl/games',
      '/sports/crint/games',
      '/sports/cricpsl/games',
      '/sports/criclcl/games',
      '/sports/cricpakt20cup/games',
    ])

    expect(basketballGroup).toMatchObject({
      type: 'group',
      href: '/sports/basketball/games',
    })
    expect(basketballGroup?.links.map(link => link.href)).toEqual([
      '/sports/nba/games',
      '/sports/cbb/games',
      '/sports/bkcl/games',
      '/sports/cwbb/games',
      '/sports/euroleague/games',
      '/sports/bkcba/games',
      '/sports/bknbl/games',
      '/sports/bkfr1/games',
    ])
  })

  it('builds the esports live sidebar hrefs with the spec order and cs2 alias path', () => {
    const rows: SportsMenuSidebarRow[] = [
      buildLinkRow({ id: 'top-link-live-sports-live-0', label: 'Live', href: '/sports/live' }),
      buildLinkRow({
        id: 'top-link-futures-sports-futures-nba-1',
        label: 'Futures',
        href: '/sports/futures/nba',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-lol',
        label: 'LoL',
        href: '/sports/league-of-legends/games',
        menuSlug: 'league-of-legends',
        parentId: 'group-esports-13',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-cs2',
        label: 'CS2',
        href: '/sports/counter-strike/games',
        menuSlug: 'counter-strike',
        parentId: 'group-esports-13',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-dota-2',
        label: 'Dota 2',
        href: '/sports/dota-2/games',
        menuSlug: 'dota-2',
        parentId: 'group-esports-13',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-valorant',
        label: 'Valorant',
        href: '/sports/valorant/games',
        menuSlug: 'valorant',
        parentId: 'group-esports-13',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-rocket-league',
        label: 'Rocket League',
        href: '/sports/rocket-league/games',
        menuSlug: 'rocket-league',
        parentId: 'group-esports-13',
      }),
      buildLinkRow({
        id: 'group-esports-13-link-starcraft-brood-war',
        label: 'StarCraft: Brood War',
        href: '/sports/starcraft-brood-war/props',
        menuSlug: 'starcraft-brood-war',
        parentId: 'group-esports-13',
      }),
    ]

    expect(flattenMenuHrefs(buildSportsSidebarEntries(rows, 'esports'))).toEqual([
      '/esports/live',
      '/esports/soon',
      '/esports/league-of-legends/games',
      '/esports/cs2/games',
      '/esports/valorant/games',
      '/esports/dota-2/games',
      '/esports/rocket-league/games',
      '/esports/starcraft-brood-war/props',
    ])
  })
})
