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
    source: { href: '/sports/live' },
  },
  {
    type: 'link',
    href: '/sports/soon',
    id: 'sports-top-link-upcoming',
    label: 'Upcoming',
    source: { href: '/sports/futures/nba' },
  },
  {
    type: 'link',
    source: { href: '/sports/futures/nba' },
  },
  {
    type: 'divider',
    id: 'divider-2',
    source: { id: 'divider-2' },
  },
  {
    type: 'header',
    id: 'header-3',
    label: 'All Sports',
    source: { id: 'header-3' },
  },
  {
    type: 'link',
    source: { id: 'top-link-nba-sports-nba-games-4' },
  },
  {
    type: 'link',
    source: { id: 'top-link-ncaab-sports-cbb-games-5' },
  },
  {
    type: 'link',
    id: 'sports-top-link-ucl',
    source: { menuSlug: 'ucl' },
  },
  {
    type: 'link',
    source: { id: 'top-link-nhl-sports-nhl-games-6' },
  },
  {
    type: 'group',
    href: '/sports/ufc/props',
    menuSlug: 'ufc',
    source: { id: 'group-ufc-7' },
    links: [
      { type: 'link', source: { menuSlug: 'ufc' } },
      { type: 'link', source: { menuSlug: 'zuffa' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/football/props',
    menuSlug: 'football',
    source: { id: 'group-football-9' },
    links: [
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
      { type: 'link', source: { menuSlug: 'uef-qualifiers' } },
      { type: 'link', source: { menuSlug: 'fifa-friendlies' } },
      { type: 'link', source: { menuSlug: 'bra2' } },
      { type: 'link', source: { menuSlug: 'laliga' } },
      { type: 'link', source: { menuSlug: 'tur' } },
      { type: 'link', source: { menuSlug: 'col1' } },
      { type: 'link', source: { menuSlug: 'mls' } },
      { type: 'link', source: { menuSlug: 'mex' } },
      { type: 'link', source: { menuSlug: 'bundesliga' } },
      { type: 'link', source: { menuSlug: 'csl' } },
      { type: 'link', source: { menuSlug: 'ucl' } },
      { type: 'link', source: { menuSlug: 'epl' } },
      { type: 'link', source: { menuSlug: 'cze1' } },
      { type: 'link', source: { menuSlug: 'jap' } },
      { type: 'link', source: { menuSlug: 'ja2' } },
      { type: 'link', source: { menuSlug: 'ligue-1' } },
      { type: 'link', source: { menuSlug: 'nor' } },
      { type: 'link', source: { menuSlug: 'aus' } },
      { type: 'link', source: { menuSlug: 'den' } },
      { type: 'link', source: { menuSlug: 'sea' } },
      { type: 'link', source: { menuSlug: 'kor' } },
      { type: 'link', source: { menuSlug: 'ere' } },
      { type: 'link', source: { menuSlug: 'spl' } },
      { type: 'link', source: { menuSlug: 'bra' } },
      { type: 'link', source: { menuSlug: 'por' } },
      { type: 'link', source: { menuSlug: 'chi1' } },
      { type: 'link', source: { menuSlug: 'mar1' } },
      { type: 'link', source: { menuSlug: 'per1' } },
      { type: 'link', source: { menuSlug: 'lib' } },
      { type: 'link', source: { menuSlug: 'cdr' } },
      { type: 'link', source: { menuSlug: 'sud' } },
      { type: 'link', source: { menuSlug: 'egy1' } },
      { type: 'link', source: { menuSlug: 'uel' } },
      { type: 'link', source: { menuSlug: 'rou1' } },
      { type: 'link', source: { menuSlug: 'ucol' } },
      { type: 'link', source: { menuSlug: 'bol1' } },
      { type: 'link', source: { menuSlug: 'itc' } },
      { type: 'link', source: { menuSlug: 'dfb' } },
      { type: 'link', source: { menuSlug: 'cde' } },
      { type: 'link', source: { menuSlug: 'efl-cup' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/tennis/games',
    menuSlug: 'tennis',
    source: { id: 'group-tennis-12' },
    links: [
      { type: 'link', source: { menuSlug: 'atp' } },
      { type: 'link', source: { menuSlug: 'wta' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/cricket/games',
    menuSlug: 'cricket',
    source: { id: 'top-link-cricket-sports-crint-games-16' },
    links: [
      { type: 'link', source: { menuSlug: 'cricipl' } },
      { type: 'link', source: { menuSlug: 'crint' } },
      { type: 'link', source: { menuSlug: 'cricpsl' } },
      { type: 'link', source: { menuSlug: 'criclcl' } },
      { type: 'link', source: { menuSlug: 'cricpakt20cup' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/basketball/games',
    menuSlug: 'basketball',
    source: { id: 'group-basketball-10' },
    links: [
      { type: 'link', source: { menuSlug: 'nba' } },
      { type: 'link', source: { menuSlug: 'cbb' } },
      { type: 'link', source: { menuSlug: 'bkarg' } },
      { type: 'link', source: { menuSlug: 'bkcl' } },
      { type: 'link', source: { menuSlug: 'cwbb' } },
      { type: 'link', source: { menuSlug: 'euroleague' } },
      { type: 'link', source: { menuSlug: 'bkcba' } },
      { type: 'link', source: { menuSlug: 'bkkbl' } },
      { type: 'link', source: { menuSlug: 'bkligend' } },
      { type: 'link', source: { menuSlug: 'bkseriea' } },
      { type: 'link', source: { menuSlug: 'bknbl' } },
      { type: 'link', source: { menuSlug: 'bkfr1' } },
    ],
  },
  {
    type: 'link',
    id: 'sports-top-link-mlb',
    label: 'Baseball',
    source: { menuSlug: 'mlb' },
  },
  {
    type: 'group',
    href: '/sports/hockey/games',
    menuSlug: 'hockey',
    source: { id: 'group-hockey-15' },
    links: [
      { type: 'link', source: { menuSlug: 'nhl' } },
      { type: 'link', source: { menuSlug: 'khl' } },
      { type: 'link', source: { menuSlug: 'ahl' } },
      { type: 'link', source: { menuSlug: 'dehl' } },
      { type: 'link', source: { menuSlug: 'cehl' } },
      { type: 'link', source: { menuSlug: 'shl' } },
    ],
  },
  {
    type: 'group',
    href: '/sports/rugby/games',
    menuSlug: 'rugby',
    source: { id: 'group-rugby-17' },
    links: [
      { type: 'link', source: { menuSlug: 'rusrp' } },
      { type: 'link', source: { menuSlug: 'ruprem' } },
      { type: 'link', source: { menuSlug: 'ruurc' } },
      { type: 'link', source: { menuSlug: 'rutopft' } },
      { type: 'link', source: { menuSlug: 'rueuchamp' } },
    ],
  },
  {
    type: 'link',
    href: '/sports/wtt-mens-singles/games',
    iconSource: { id: 'group-table-tennis-18' },
    id: 'sports-top-link-table-tennis',
    label: 'Table Tennis',
    menuSlug: 'wtt-mens-singles',
    source: { menuSlug: 'wtt-mens-singles' },
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
    href: '/sports/chess/games',
    source: { menuSlug: 'chess' },
  },
  {
    type: 'link',
    source: { menuSlug: 'boxing' },
  },
]

const esportsSidebarSpec: SidebarSpecItem[] = [
  {
    type: 'link',
    href: '/esports/live',
    id: 'esports-top-link-live',
    source: { href: '/sports/live' },
  },
  {
    type: 'link',
    href: '/esports/soon',
    id: 'esports-top-link-upcoming',
    label: 'Upcoming',
    source: { href: '/sports/futures/nba' },
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
    type: 'link',
    href: '/esports/league-of-legends/games',
    source: { menuSlug: 'league-of-legends' },
  },
  {
    type: 'link',
    href: '/esports/cs2/games',
    source: { menuSlug: 'counter-strike' },
  },
  {
    type: 'link',
    href: '/esports/valorant/games',
    source: { menuSlug: 'valorant' },
  },
  {
    type: 'link',
    href: '/esports/dota-2/games',
    source: { menuSlug: 'dota-2' },
  },
  {
    type: 'link',
    href: '/esports/rainbow-six-siege/games',
    source: { menuSlug: 'rainbow-six-siege' },
  },
  {
    type: 'link',
    href: '/esports/mobile-legends-bang-bang/games',
    source: { menuSlug: 'mobile-legends-bang-bang' },
  },
  {
    type: 'link',
    href: '/esports/overwatch/games',
    source: { menuSlug: 'overwatch' },
  },
  {
    type: 'link',
    href: '/esports/honor-of-kings/games',
    source: { menuSlug: 'honor-of-kings' },
  },
  {
    type: 'link',
    href: '/esports/call-of-duty/games',
    source: { menuSlug: 'call-of-duty' },
  },
  {
    type: 'link',
    href: '/esports/rocket-league/games',
    source: { menuSlug: 'rocket-league' },
  },
  {
    type: 'link',
    href: '/esports/starcraft-2/games',
    source: { menuSlug: 'starcraft-2' },
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
  if (!row || !row.label || !row.icon_url) {
    return null
  }

  const iconRow = findRow(rows, spec.iconSource, 'group') ?? findRow(rows, spec.iconSource, 'link')

  return {
    type: 'link',
    id: spec.id ?? row.id,
    label: spec.label ?? row.label,
    href: spec.href ?? row.href ?? '',
    iconPath: iconRow?.icon_url ?? row.icon_url,
    menuSlug: spec.menuSlug === undefined
      ? normalizeComparableValue(row.menu_slug)
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
