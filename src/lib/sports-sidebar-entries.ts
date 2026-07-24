import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { normalizeComparableValue, slugifyText } from '@/lib/slug'
import { isMenuRowForVertical } from '@/lib/sports-menu-vertical'

export interface SportsMenuSidebarRow {
  id: string
  item_type: string
  label: string | null
  href: string | null
  icon_url: string | null
  parent_id: string | null
  menu_slug: string | null
  sort_order?: number
  sidebar_category?: boolean
  sidebar_enabled?: boolean
  sidebar_featured?: boolean
  sidebar_sort_order?: number
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

function compareConfiguredRows(a: SportsMenuSidebarRow, b: SportsMenuSidebarRow) {
  return (a.sidebar_sort_order ?? 0) - (b.sidebar_sort_order ?? 0)
    || a.id.localeCompare(b.id)
}

function compareChildRows(a: SportsMenuSidebarRow, b: SportsMenuSidebarRow) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || a.id.localeCompare(b.id)
}

function isRetiredSportsMenuRow(row: SportsMenuSidebarRow) {
  const menuSlug = normalizeComparableValue(row.menu_slug)
  const href = row.href?.split(/[?#]/)[0]?.replace(/\/+$/, '') ?? ''

  return menuSlug === 'world-cup'
    || menuSlug === 'futures'
    || href === '/sports/world-cup'
    || href.startsWith('/sports/world-cup/')
    || href === '/sports/futures'
    || href.startsWith('/sports/futures/')
}

function toConfiguredLinkEntry(row: SportsMenuSidebarRow): SportsMenuLinkEntry | null {
  if (row.item_type !== 'link' || !row.label || !row.href || !row.icon_url) {
    return null
  }

  return {
    type: 'link',
    id: row.id,
    label: row.label,
    href: row.href,
    iconPath: row.icon_url,
    menuSlug: normalizeComparableValue(row.menu_slug),
  }
}

function toConfiguredGroupEntry(
  row: SportsMenuSidebarRow,
  rows: SportsMenuSidebarRow[],
): SportsMenuGroupEntry | null {
  if ((row.item_type !== 'group' && row.item_type !== 'link') || !row.label || !row.icon_url) {
    return null
  }

  const childLinks = rows
    .filter(candidate => candidate.parent_id === row.id && candidate.sidebar_enabled === true)
    .sort(compareChildRows)
    .map(toConfiguredLinkEntry)
    .filter((entry): entry is SportsMenuLinkEntry => Boolean(entry))
  const parentLink = row.item_type === 'link' ? toConfiguredLinkEntry(row) : null
  const links = parentLink && !childLinks.some(link => link.href === parentLink.href)
    ? [{ ...parentLink, id: `${parentLink.id}-all`, label: 'All' }, ...childLinks]
    : childLinks
  if (links.length === 0) {
    return null
  }

  const menuSlug = normalizeComparableValue(row.menu_slug) || slugifyText(row.label)
  const landingLink = links.find(link => link.menuSlug === menuSlug) ?? links[0]

  return {
    type: 'group',
    id: row.id,
    label: row.label,
    href: row.href || landingLink.href,
    iconPath: row.icon_url,
    menuSlug,
    links,
  }
}

function toConfiguredEntry(
  row: SportsMenuSidebarRow,
  rows: SportsMenuSidebarRow[],
): SportsMenuLinkEntry | SportsMenuGroupEntry | null {
  const hasEnabledChildren = rows.some(candidate => (
    candidate.parent_id === row.id
    && candidate.item_type === 'link'
    && candidate.sidebar_enabled === true
  ))
  if (row.item_type === 'group' || hasEnabledChildren) {
    return toConfiguredGroupEntry(row, rows)
  }

  return toConfiguredLinkEntry(row)
}

function buildConfiguredSportsSidebarEntries(
  rows: SportsMenuSidebarRow[],
  vertical: SportsVertical,
) {
  const spec = vertical === 'esports' ? esportsSidebarSpec : sportsSidebarSpec
  const verticalRows = rows.filter(row =>
    isMenuRowForVertical(row, vertical)
    && (vertical !== 'sports' || !isRetiredSportsMenuRow(row)),
  )
  const systemEntries = spec
    .slice(0, 4)
    .flatMap((item): SportsMenuEntry[] => {
      if (item.type === 'divider') {
        return [{ type: 'divider', id: item.id }]
      }

      if (item.type === 'header') {
        return [{ type: 'header', id: item.id, label: item.label }]
      }

      if (item.type === 'group') {
        const entry = toGroupEntry(rows, item)
        return entry ? [entry] : []
      }

      const entry = toLinkEntry(rows, item)
      return entry ? [entry] : []
    })

  const enabledCategories = verticalRows.filter(row => row.sidebar_category && row.sidebar_enabled)
  const featuredEntries = enabledCategories
    .filter(row => row.sidebar_featured)
    .sort(compareConfiguredRows)
    .map(row => toConfiguredEntry(row, verticalRows))
    .filter((entry): entry is SportsMenuLinkEntry | SportsMenuGroupEntry => Boolean(entry))
  const standardEntries = enabledCategories
    .filter(row => !row.sidebar_featured && !row.parent_id)
    .sort(compareConfiguredRows)
    .map(row => toConfiguredEntry(row, verticalRows))
    .filter((entry): entry is SportsMenuLinkEntry | SportsMenuGroupEntry => Boolean(entry))

  return [...systemEntries, ...featuredEntries, ...standardEntries]
}

export function buildSportsSidebarEntries(
  rows: SportsMenuSidebarRow[],
  vertical: SportsVertical,
): SportsMenuEntry[] {
  if (rows.some(row => row.sidebar_category && isMenuRowForVertical(row, vertical))) {
    return buildConfiguredSportsSidebarEntries(rows, vertical)
  }

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
