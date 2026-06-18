import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { normalizeComparableValue, slugifyText } from '@/lib/slug'

export interface SportsMenuSidebarRow {
  id: string
  item_type: string
  label: string | null
  href: string | null
  icon_url: string | null
  parent_id: string | null
  menu_slug: string | null
}

interface MenuRowSource {
  id?: string
  href?: string
  menuSlug?: string
}

interface SidebarLinkSpec {
  type: 'link'
  source: MenuRowSource
  href?: string
  id?: string
  iconSource?: MenuRowSource
  label?: string
  menuSlug?: string | null
}

interface SidebarGroupSpec {
  type: 'group'
  href?: string
  iconSource?: MenuRowSource
  label?: string
  menuSlug: string
  source: MenuRowSource
  links: SidebarLinkSpec[]
}

interface SidebarDividerSpec {
  type: 'divider'
  id: string
  source?: MenuRowSource
}

interface SidebarHeaderSpec {
  type: 'header'
  id: string
  label: string
  source?: MenuRowSource
}

type SidebarSpecItem = SidebarLinkSpec | SidebarGroupSpec | SidebarDividerSpec | SidebarHeaderSpec

const sportsSidebarSpec: SidebarSpecItem[] = [
  {
    type: 'link',
    href: '/sports/live',
    id: 'sports-top-link-live',
    source: { id: 'top-link-live-sports-live-0' },
  },
  {
    type: 'link',
    href: '/sports/soon',
    id: 'sports-top-link-upcoming',
    label: 'Upcoming',
    source: { id: 'top-link-futures-sports-futures-nba-1' },
  },
  {
    type: 'divider',
    id: 'sports-divider',
  },
  {
    type: 'header',
    id: 'sports-header',
    label: 'All Sports',
  },
  {
    type: 'link',
    id: 'sports-top-link-world-cup',
    source: { menuSlug: 'world-cup' },
  },
  {
    type: 'link',
    id: 'sports-top-link-mlb',
    source: { menuSlug: 'mlb' },
  },
  {
    type: 'link',
    source: { id: 'top-link-nhl-sports-nhl-games-6' },
  },
  {
    type: 'group',
    href: '/sports/mma/games',
    menuSlug: 'ufc',
    source: { id: 'group-ufc-7' },
    links: [
      { type: 'link', source: { menuSlug: 'mma' } },
      { type: 'link', source: { menuSlug: 'ufc' } },
      { type: 'link', source: { menuSlug: 'powerslap' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/football/games',
    menuSlug: 'football',
    source: { id: 'group-football-9' },
    links: [
      { type: 'link', source: { menuSlug: 'football' } },
      { type: 'link', source: { menuSlug: 'cfl' } },
      { type: 'link', source: { menuSlug: 'nfl' } },
      { type: 'link', source: { menuSlug: 'cfb' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/soccer/games',
    menuSlug: 'soccer',
    source: { id: 'group-soccer-11' },
    links: [
      { type: 'link', source: { menuSlug: 'soccer' } },
      { type: 'link', source: { menuSlug: 'world-cup' } },
      { type: 'link', source: { menuSlug: 'bol1' } },
      { type: 'link', source: { menuSlug: 'el2' } },
      { type: 'link', source: { menuSlug: 'mls' } },
      { type: 'link', source: { menuSlug: 'nor' } },
      { type: 'link', source: { menuSlug: 'bra2' } },
      { type: 'link', source: { menuSlug: 'mar1' } },
      { type: 'link', source: { menuSlug: 'col1' } },
      { type: 'link', source: { menuSlug: 'csl' } },
      { type: 'link', source: { menuSlug: 'swe' } },
      { type: 'link', source: { menuSlug: 'es2' } },
      { type: 'link', source: { menuSlug: 'nor2' } },
      { type: 'link', source: { menuSlug: 'chi1' } },
      { type: 'link', source: { menuSlug: 'trsk' } },
      { type: 'link', source: { menuSlug: 'ja2' } },
      { type: 'link', source: { menuSlug: 'isl1' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/tennis/games',
    menuSlug: 'tennis',
    source: { id: 'group-tennis-12' },
    links: [
      { type: 'link', source: { menuSlug: 'tennis' } },
      { type: 'link', source: { menuSlug: 'atp' } },
      { type: 'link', source: { menuSlug: 'wta' } },
      { type: 'link', source: { menuSlug: 'itf' } },
      { type: 'link', source: { menuSlug: 'atp-doubles' } },
      { type: 'link', source: { menuSlug: 'wta-doubles' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/cricket/games',
    menuSlug: 'cricket',
    source: { id: 'top-link-cricket-sports-crint-games-16' },
    links: [
      { type: 'link', source: { menuSlug: 'cricket' } },
      { type: 'link', source: { menuSlug: 'crint' } },
      { type: 'link', source: { menuSlug: 'cricmlc' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/basketball/games',
    menuSlug: 'basketball',
    source: { id: 'group-basketball-10' },
    links: [
      { type: 'link', source: { menuSlug: 'basketball' } },
      { type: 'link', source: { menuSlug: 'wnba' } },
      { type: 'link', source: { menuSlug: 'bkfr1' } },
      { type: 'link', source: { menuSlug: 'bkarg' } },
      { type: 'link', source: { menuSlug: 'bkbsl' } },
      { type: 'link', source: { menuSlug: 'bkbbl' } },
      { type: 'link', source: { menuSlug: 'bkligend' } },
      { type: 'link', source: { menuSlug: 'bkisrsl' } },
      { type: 'link', source: { menuSlug: 'bkplk' } },
      { type: 'link', source: { menuSlug: 'bkseriea' } },
      { type: 'link', source: { menuSlug: 'nba' } },
      { type: 'link', source: { menuSlug: 'bkbsn' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/baseball/games',
    menuSlug: 'baseball',
    source: { id: 'group-baseball-14' },
    links: [
      { type: 'link', source: { menuSlug: 'baseball' } },
      { type: 'link', source: { menuSlug: 'mlb' } },
      { type: 'link', source: { menuSlug: 'kbo' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/hockey/games',
    menuSlug: 'hockey',
    source: { id: 'group-hockey-15' },
    links: [
      { type: 'link', source: { menuSlug: 'hockey' } },
      { type: 'link', source: { menuSlug: 'ahl' } },
      { type: 'link', source: { menuSlug: 'nhl' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/rugby/games',
    menuSlug: 'rugby',
    source: { id: 'group-rugby-17' },
    links: [
      { type: 'link', source: { menuSlug: 'rugby' } },
      { type: 'link', source: { menuSlug: 'rutopft' } },
      { type: 'link', source: { menuSlug: 'rusrp' } },
      { type: 'link', source: { menuSlug: 'ruprem' } },
      { type: 'link', source: { menuSlug: 'ruurc' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/table-tennis/games',
    menuSlug: 'table-tennis',
    source: { id: 'group-table-tennis-18' },
    links: [
      { type: 'link', source: { menuSlug: 'table-tennis' } },
      { type: 'link', source: { menuSlug: 'wtt-mens-singles' } },
      { type: 'link', source: { menuSlug: 'wtt-womens-singles' } },
    ],
  },
  {
    type: 'link',
    source: { menuSlug: 'golf' },
  },
  {
    type: 'link',
    source: { menuSlug: 'f1' },
  },
  {
    type: 'link',
    source: { menuSlug: 'boxing' },
  },
  {
    type: 'link',
    source: { menuSlug: 'pickleball' },
  },
  {
    type: 'group',
    href: '/sports/lacrosse/games',
    menuSlug: 'lacrosse',
    source: { id: 'group-lacrosse-24' },
    links: [
      { type: 'link', source: { menuSlug: 'lacrosse' } },
      { type: 'link', source: { menuSlug: 'wll' } },
      { type: 'link', source: { menuSlug: 'pll' } },
    ],
  },
  {
    type: 'link',
    source: { id: 'sports-top-link-esports' },
    menuSlug: null,
  },
]

const esportsSidebarSpec: SidebarSpecItem[] = [
  {
    type: 'link',
    href: '/esports/live',
    id: 'esports-top-link-live',
    source: { id: 'top-link-live-sports-live-0' },
  },
  {
    type: 'link',
    href: '/esports/soon',
    id: 'esports-top-link-upcoming',
    label: 'Upcoming',
    source: { id: 'top-link-futures-sports-futures-nba-1' },
  },
  {
    type: 'divider',
    id: 'esports-divider',
  },
  {
    type: 'header',
    id: 'esports-header',
    label: 'Games',
  },
  {
    type: 'group',
    href: '/esports/league-of-legends/games',
    menuSlug: 'league-of-legends',
    source: { id: 'group-esports-league-of-legends' },
    links: [
      { type: 'link', source: { id: 'group-esports-league-of-legends-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/league-of-legends/props',
        iconSource: { id: 'group-esports-league-of-legends' },
        label: 'Props',
        source: { id: 'group-esports-league-of-legends-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-league-of-legends-asia-masters' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-league-of-legends-mid-season-invitational' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/cs2/games',
    menuSlug: 'counter-strike',
    source: { id: 'group-esports-cs2' },
    links: [
      { type: 'link', source: { id: 'group-esports-cs2-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/cs2/props',
        iconSource: { id: 'group-esports-cs2' },
        label: 'Props',
        source: { id: 'group-esports-cs2-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-cs2-cct-europe' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-dust2-dk-ligaen' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-european-pro-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-gamers-club-liga-serie-a' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-iem' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-nodwin-clutch-series' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-united21' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-cs2-xse-pro-league' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/dota-2/games',
    menuSlug: 'dota-2',
    source: { id: 'group-esports-dota-2' },
    links: [
      { type: 'link', source: { id: 'group-esports-dota-2-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/dota-2/props',
        iconSource: { id: 'group-esports-dota-2' },
        label: 'Props',
        source: { id: 'group-esports-dota-2-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-dota-2-european-pro-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-dota-2-the-international' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/valorant/games',
    menuSlug: 'valorant',
    source: { id: 'group-esports-valorant' },
    links: [
      { type: 'link', source: { id: 'group-esports-valorant-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/valorant/props',
        iconSource: { id: 'group-esports-valorant' },
        label: 'Props',
        source: { id: 'group-esports-valorant-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-valorant-vcl' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-valorant-vct' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/mobile-legends-bang-bang/games',
    menuSlug: 'mobile-legends-bang-bang',
    source: { id: 'group-esports-mobile-legends-bang-bang' },
    links: [
      { type: 'link', source: { id: 'group-esports-mobile-legends-bang-bang-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/mobile-legends-bang-bang/props',
        iconSource: { id: 'group-esports-mobile-legends-bang-bang' },
        label: 'Props',
        source: { id: 'group-esports-mobile-legends-bang-bang-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-mobile-legends-bang-bang-betboom-rise-of-legends' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/overwatch/games',
    menuSlug: 'overwatch',
    source: { id: 'group-esports-overwatch' },
    links: [
      { type: 'link', source: { id: 'group-esports-overwatch-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/overwatch/props',
        iconSource: { id: 'group-esports-overwatch' },
        label: 'Props',
        source: { id: 'group-esports-overwatch-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-overwatch-ocs' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/rainbow-six-siege/games',
    menuSlug: 'rainbow-six-siege',
    source: { id: 'group-esports-rainbow-six-siege' },
    links: [
      { type: 'link', source: { id: 'group-esports-rainbow-six-siege-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/rainbow-six-siege/props',
        iconSource: { id: 'group-esports-rainbow-six-siege' },
        label: 'Props',
        source: { id: 'group-esports-rainbow-six-siege-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-rainbow-six-siege-asia-pacific-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-rainbow-six-siege-cn-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-rainbow-six-siege-north-america-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-rainbow-six-siege-south-america-league' }, menuSlug: null },
    ],
  },
  {
    type: 'group',
    href: '/esports/call-of-duty/games',
    menuSlug: 'call-of-duty',
    source: { id: 'group-esports-call-of-duty' },
    links: [
      { type: 'link', source: { id: 'group-esports-call-of-duty-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/call-of-duty/props',
        iconSource: { id: 'group-esports-call-of-duty' },
        label: 'Props',
        source: { id: 'group-esports-call-of-duty-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-call-of-duty-call-of-duty-league' }, menuSlug: null },
    ],
  },
  {
    type: 'link',
    href: '/esports/starcraft-2/games',
    source: { menuSlug: 'starcraft-2' },
  },
  {
    type: 'group',
    href: '/esports/honor-of-kings/games',
    menuSlug: 'honor-of-kings',
    source: { id: 'group-esports-honor-of-kings' },
    links: [
      { type: 'link', source: { id: 'group-esports-honor-of-kings-games' }, menuSlug: null },
      {
        type: 'link',
        href: '/esports/honor-of-kings/props',
        iconSource: { id: 'group-esports-honor-of-kings' },
        label: 'Props',
        source: { id: 'group-esports-honor-of-kings-props' },
        menuSlug: null,
      },
      { type: 'link', source: { id: 'group-esports-honor-of-kings-arena-of-valor-premier-league' }, menuSlug: null },
      { type: 'link', source: { id: 'group-esports-honor-of-kings-king-pro-league' }, menuSlug: null },
    ],
  },
  {
    type: 'link',
    href: '/esports/rocket-league/games',
    source: { menuSlug: 'rocket-league' },
  },
  {
    type: 'link',
    href: '/esports/starcraft-brood-war/props',
    source: { menuSlug: 'starcraft-brood-war' },
  },
]

function findRow(
  rows: SportsMenuSidebarRow[],
  source: MenuRowSource | undefined,
  itemType?: 'link' | 'group' | 'header' | 'divider',
) {
  if (!source) {
    return null
  }

  return rows.find((row) => {
    if (itemType && row.item_type !== itemType) {
      return false
    }

    if (source.id && row.id !== source.id) {
      return false
    }

    if (source.href && row.href !== source.href) {
      return false
    }

    if (source.menuSlug && normalizeComparableValue(row.menu_slug) !== normalizeComparableValue(source.menuSlug)) {
      return false
    }

    return true
  }) ?? null
}

function resolveGroupMenuSlug(spec: SidebarGroupSpec, row: SportsMenuSidebarRow) {
  if (spec.menuSlug) {
    return spec.menuSlug
  }

  const configuredSlug = normalizeComparableValue(row.menu_slug)
  if (configuredSlug) {
    return configuredSlug
  }

  const label = row.label?.trim()
  return label ? slugifyText(label) : null
}

function toLinkEntry(
  rows: SportsMenuSidebarRow[],
  spec: SidebarLinkSpec,
): SportsMenuLinkEntry | null {
  const row = findRow(rows, spec.source, 'link')
  const iconRow = findRow(rows, spec.iconSource, 'group') ?? findRow(rows, spec.iconSource, 'link')
  const label = spec.label ?? row?.label
  const href = spec.href ?? row?.href ?? ''
  const iconPath = iconRow?.icon_url ?? row?.icon_url

  if (!label || !href || !iconPath) {
    return null
  }

  return {
    type: 'link',
    id: spec.id ?? row?.id ?? `fallback-${slugifyText(href)}`,
    label,
    href,
    iconPath,
    menuSlug: spec.menuSlug === undefined
      ? normalizeComparableValue(row?.menu_slug)
      : spec.menuSlug,
  }
}

function toGroupEntry(
  rows: SportsMenuSidebarRow[],
  spec: SidebarGroupSpec,
): SportsMenuGroupEntry | null {
  const row = findRow(rows, spec.source, 'group')
  if (!row || !row.label || !row.icon_url) {
    return null
  }

  const iconRow = findRow(rows, spec.iconSource, 'group') ?? findRow(rows, spec.iconSource, 'link')
  const links = spec.links
    .map(linkSpec => toLinkEntry(rows, linkSpec))
    .filter((link): link is SportsMenuLinkEntry => Boolean(link))
  if (links.length === 0) {
    return null
  }

  const menuSlug = resolveGroupMenuSlug(spec, row)
  if (!menuSlug) {
    return null
  }

  return {
    type: 'group',
    id: row.id,
    label: spec.label ?? row.label,
    href: spec.href ?? row.href ?? '',
    iconPath: iconRow?.icon_url ?? row.icon_url,
    menuSlug,
    links,
  }
}

export function buildSportsSidebarEntries(
  rows: SportsMenuSidebarRow[],
  vertical: SportsVertical,
): SportsMenuEntry[] {
  const spec = vertical === 'esports' ? esportsSidebarSpec : sportsSidebarSpec
  const entries: SportsMenuEntry[] = []

  for (const item of spec) {
    if (item.type === 'divider') {
      entries.push({
        type: 'divider',
        id: item.id,
      })
      continue
    }

    if (item.type === 'header') {
      entries.push({
        type: 'header',
        id: item.id,
        label: item.label,
      })
      continue
    }

    if (item.type === 'group') {
      const entry = toGroupEntry(rows, item)
      if (entry) {
        entries.push(entry)
      }
      continue
    }

    const entry = toLinkEntry(rows, item)
    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}
