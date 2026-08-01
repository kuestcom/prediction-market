import type { SportsMenuEntry, SportsMenuGroupEntry, SportsMenuLinkEntry } from '@/lib/sports-menu-types'
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
    type: 'group',
    href: '/sports/soccer/games',
    menuSlug: 'soccer',
    source: { id: 'group-soccer-11' },
    label: 'Soccer',
    links: [
      {
        type: 'link',
        href: '/sports/soccer/games',
        label: 'All',
        source: { menuSlug: 'soccer' },
      },
      {
        type: 'link',
        href: '/sports/clf/games',
        label: 'Club Friendlies',
        source: { menuSlug: 'clf' },
      },
      {
        type: 'link',
        href: '/sports/mls/games',
        label: 'MLS',
        source: { menuSlug: 'mls' },
      },
      {
        type: 'link',
        href: '/sports/scop/games',
        label: 'Scottish Premiership',
        source: { menuSlug: 'scop' },
      },
      {
        type: 'link',
        href: '/sports/nor/games',
        label: 'Eliteserien',
        source: { menuSlug: 'nor' },
      },
      {
        type: 'link',
        href: '/sports/den/games',
        label: 'Danish Superliga',
        source: { menuSlug: 'den' },
      },
      {
        type: 'link',
        href: '/sports/mex/games',
        label: 'Liga MX',
        source: { menuSlug: 'mex' },
      },
      {
        type: 'link',
        href: '/sports/rou1/games',
        label: 'SuperLiga',
        source: { menuSlug: 'rou1' },
      },
      {
        type: 'link',
        href: '/sports/bol1/games',
        label: 'Bolivian Primera División',
        source: { menuSlug: 'bol1' },
      },
      {
        type: 'link',
        href: '/sports/aut/games',
        label: 'Austria Bundesliga',
        source: { menuSlug: 'aut' },
      },
      {
        type: 'link',
        href: '/sports/sui/games',
        label: 'Swiss Super League',
        source: { menuSlug: 'sui' },
      },
      {
        type: 'link',
        href: '/sports/kor2/games',
        label: 'K League 2',
        source: { menuSlug: 'kor2' },
      },
      {
        type: 'link',
        href: '/sports/chi1/games',
        label: 'Liga de Primera',
        source: { menuSlug: 'chi1' },
      },
      {
        type: 'link',
        href: '/sports/hr1/games',
        label: 'Prva Liga',
        source: { menuSlug: 'hr1' },
      },
      {
        type: 'link',
        href: '/sports/cze1/games',
        label: 'Chance Liga',
        source: { menuSlug: 'cze1' },
      },
      {
        type: 'link',
        href: '/sports/csl/games',
        label: 'Chinese Super League',
        source: { menuSlug: 'csl' },
      },
      {
        type: 'link',
        href: '/sports/svk1/games',
        label: 'Niké liga',
        source: { menuSlug: 'svk1' },
      },
      {
        type: 'link',
        href: '/sports/pol/games',
        label: 'Ekstraklasa',
        source: { menuSlug: 'pol' },
      },
      {
        type: 'link',
        href: '/sports/fin1/games',
        label: 'Veikkausliiga',
        source: { menuSlug: 'fin1' },
      },
      {
        type: 'link',
        href: '/sports/argpn/games',
        label: 'Primera Nacional',
        source: { menuSlug: 'argpn' },
      },
      {
        type: 'link',
        href: '/sports/ptsc/games',
        label: 'Portugal Super Cup',
        source: { menuSlug: 'ptsc' },
      },
      {
        type: 'link',
        href: '/sports/bra2/games',
        label: 'Brasileirão Série B',
        source: { menuSlug: 'bra2' },
      },
      {
        type: 'link',
        href: '/sports/bra/games',
        label: 'Brasileirão Série A',
        source: { menuSlug: 'bra' },
      },
      {
        type: 'link',
        href: '/sports/brco/games',
        label: 'Copa do Brasil',
        source: { menuSlug: 'brco' },
      },
      {
        type: 'link',
        href: '/sports/kor/games',
        label: 'K League 1',
        source: { menuSlug: 'kor' },
      },
      {
        type: 'link',
        href: '/sports/uru1/games',
        label: 'Uruguayan Primera División',
        source: { menuSlug: 'uru1' },
      },
      {
        type: 'link',
        href: '/sports/bul/games',
        label: 'efbet Liga',
        source: { menuSlug: 'bul' },
      },
      {
        type: 'link',
        href: '/sports/col1/games',
        label: 'Categoría Primera A',
        source: { menuSlug: 'col1' },
      },
      {
        type: 'link',
        href: '/sports/slo/games',
        label: 'Slovenia PrvaLiga',
        source: { menuSlug: 'slo' },
      },
      {
        type: 'link',
        href: '/sports/ucl/games',
        label: 'UCL',
        source: { menuSlug: 'ucl' },
      },
      {
        type: 'link',
        href: '/sports/per1/games',
        label: 'Liga 1',
        source: { menuSlug: 'per1' },
      },
      {
        type: 'link',
        href: '/sports/swe/games',
        label: 'Allsvenskan',
        source: { menuSlug: 'swe' },
      },
      {
        type: 'link',
        href: '/sports/uel/games',
        label: 'UEL',
        source: { menuSlug: 'uel' },
      },
      {
        type: 'link',
        href: '/sports/uslc/games',
        label: 'USL Championship',
        source: { menuSlug: 'uslc' },
      },
      {
        type: 'link',
        href: '/sports/ecu1/games',
        label: 'LigaPro Serie A',
        source: { menuSlug: 'ecu1' },
      },
      {
        type: 'link',
        href: '/sports/fpd/games',
        label: 'Liga FPD',
        source: { menuSlug: 'fpd' },
      },
      {
        type: 'link',
        href: '/sports/nwsl/games',
        label: 'NWSL',
        source: { menuSlug: 'nwsl' },
      },
      {
        type: 'link',
        href: '/sports/hun/games',
        label: 'NB I',
        source: { menuSlug: 'hun' },
      },
      {
        type: 'link',
        href: '/sports/saf1/games',
        label: 'South Africa Premiership',
        source: { menuSlug: 'saf1' },
      },
      {
        type: 'link',
        href: '/sports/srb/games',
        label: 'Serbian SuperLiga',
        source: { menuSlug: 'srb' },
      },
      {
        type: 'link',
        href: '/sports/sud/games',
        label: 'Copa Sudamericana',
        source: { menuSlug: 'sud' },
      },
      {
        type: 'link',
        href: '/sports/kaz1/games',
        label: 'Kazakhstan Premier League',
        source: { menuSlug: 'kaz1' },
      },
      {
        type: 'link',
        href: '/sports/col2/games',
        label: 'Categoría Primera B',
        source: { menuSlug: 'col2' },
      },
      {
        type: 'link',
        href: '/sports/nor2/games',
        label: 'OBOS-ligaen',
        source: { menuSlug: 'nor2' },
      },
      {
        type: 'link',
        href: '/sports/chi2/games',
        label: 'China League One',
        source: { menuSlug: 'chi2' },
      },
      {
        type: 'link',
        href: '/sports/chl2/games',
        label: 'Primera B (Chile)',
        source: { menuSlug: 'chl2' },
      },
      {
        type: 'link',
        href: '/sports/swe2/games',
        label: 'Superettan',
        source: { menuSlug: 'swe2' },
      },
      {
        type: 'link',
        href: '/sports/irl1/games',
        label: 'League of Ireland Premier Division',
        source: { menuSlug: 'irl1' },
      },
      {
        type: 'link',
        href: '/sports/usl1/games',
        label: 'USL League One',
        source: { menuSlug: 'usl1' },
      },
      {
        type: 'link',
        href: '/sports/gtm/games',
        label: 'Liga Nacional de Guatemala',
        source: { menuSlug: 'gtm' },
      },
      {
        type: 'link',
        href: '/sports/ucol/games',
        label: 'UEFA Conference League',
        source: { menuSlug: 'ucol' },
      },
      {
        type: 'link',
        href: '/sports/ere/games',
        label: 'Eredivisie',
        source: { menuSlug: 'ere' },
      },
      {
        type: 'link',
        href: '/sports/ukr1/games',
        label: 'Ukrainian Premier League',
        source: { menuSlug: 'ukr1' },
      },
      {
        type: 'link',
        href: '/sports/isl1/games',
        label: 'Besta deild karla',
        source: { menuSlug: 'isl1' },
      },
      {
        type: 'link',
        href: '/sports/lib/games',
        label: 'Copa Libertadores',
        source: { menuSlug: 'lib' },
      },
      {
        type: 'link',
        href: '/sports/uwcl/games',
        label: "Women's Champions League",
        source: { menuSlug: 'uwcl' },
      },
      {
        type: 'link',
        href: '/sports/bl2/games',
        label: '2. Bundesliga',
        source: { menuSlug: 'bl2' },
      },
      {
        type: 'link',
        href: '/sports/est1/games',
        label: 'Premium Liiga',
        source: { menuSlug: 'est1' },
      },
      {
        type: 'link',
        href: '/sports/por/games',
        label: 'Primeira Liga',
        source: { menuSlug: 'por' },
      },
      {
        type: 'link',
        href: '/sports/uzb1/games',
        label: 'Uzbekistan Super League',
        source: { menuSlug: 'uzb1' },
      },
      {
        type: 'link',
        href: '/sports/ltu1/games',
        label: 'A Lyga',
        source: { menuSlug: 'ltu1' },
      },
      {
        type: 'link',
        href: '/sports/auc/games',
        label: 'Australia Cup',
        source: { menuSlug: 'auc' },
      },
      {
        type: 'link',
        href: '/sports/trsk/games',
        label: 'TFF Süper Kupa',
        source: { menuSlug: 'trsk' },
      },
      {
        type: 'link',
        href: '/sports/spl/games',
        label: 'Saudi Pro League',
        source: { menuSlug: 'spl' },
      },
      {
        type: 'link',
        href: '/sports/enl/games',
        label: 'National League',
        source: { menuSlug: 'enl' },
      },
      {
        type: 'link',
        href: '/sports/ja2/games',
        label: 'J2 League',
        source: { menuSlug: 'ja2' },
      },
      {
        type: 'link',
        href: '/sports/lec/games',
        label: 'Leagues Cup',
        source: { menuSlug: 'lec' },
      },
      {
        type: 'link',
        href: '/sports/fr2/games',
        label: 'Ligue 2',
        source: { menuSlug: 'fr2' },
      },
      {
        type: 'link',
        href: '/sports/ven1/games',
        label: 'Venezuelan Primera División',
        source: { menuSlug: 'ven1' },
      },
      {
        type: 'link',
        href: '/sports/epl/games',
        label: 'Premier League',
        source: { menuSlug: 'epl' },
      },
      {
        type: 'link',
        href: '/sports/laliga/games',
        label: 'LaLiga',
        source: { menuSlug: 'laliga' },
      },
      {
        type: 'link',
        href: '/sports/bundesliga/games',
        label: 'Bundesliga',
        source: { menuSlug: 'bundesliga' },
      },
      {
        type: 'link',
        href: '/sports/ligue-1/games',
        label: 'Ligue 1',
        source: { menuSlug: 'ligue-1' },
      },
      {
        type: 'link',
        href: '/sports/sea/games',
        label: 'Serie A',
        source: { menuSlug: 'sea' },
      },
      {
        type: 'link',
        href: '/sports/arg/games',
        label: 'Liga Profesional de Fútbol',
        source: { menuSlug: 'arg' },
      },
      {
        type: 'link',
        href: '/sports/efl-cup/games',
        label: 'EFL CUP',
        source: { menuSlug: 'efl-cup' },
      },
      {
        type: 'link',
        href: '/sports/elc/games',
        label: 'EFL Championship',
        source: { menuSlug: 'elc' },
      },
      {
        type: 'link',
        href: '/sports/tur/games',
        label: 'Süper Lig',
        source: { menuSlug: 'tur' },
      },
      {
        type: 'link',
        href: '/sports/itc/games',
        label: 'Coppa Italia',
        source: { menuSlug: 'itc' },
      },
      {
        type: 'link',
        href: '/sports/scoc/games',
        label: 'Scottish Cup',
        source: { menuSlug: 'scoc' },
      },
      {
        type: 'link',
        href: '/sports/lva1/games',
        label: 'Virslīga',
        source: { menuSlug: 'lva1' },
      },
      {
        type: 'link',
        href: '/sports/fro1/games',
        label: 'Betri deildin',
        source: { menuSlug: 'fro1' },
      },
      {
        type: 'link',
        href: '/sports/bel1/games',
        label: 'Belgium Pro League',
        source: { menuSlug: 'bel1' },
      },
      {
        type: 'link',
        href: '/sports/ned2/games',
        label: 'Eerste Divisie',
        source: { menuSlug: 'ned2' },
      },
      {
        type: 'link',
        href: '/sports/jap/games',
        label: 'J1 League',
        source: { menuSlug: 'jap' },
      },
      {
        type: 'link',
        href: '/sports/es2/games',
        label: 'LaLiga2',
        source: { menuSlug: 'es2' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/tennis/games',
    menuSlug: 'tennis',
    source: { id: 'group-tennis-12' },
    label: 'Tennis',
    links: [
      {
        type: 'link',
        href: '/sports/tennis/games',
        label: 'All',
        source: { menuSlug: 'tennis' },
      },
      {
        type: 'link',
        href: '/sports/wta/games',
        label: 'WTA Tour',
        source: { menuSlug: 'wta' },
      },
      {
        type: 'link',
        href: '/sports/atp/games',
        label: 'ATP Tour',
        source: { menuSlug: 'atp' },
      },
      {
        type: 'link',
        href: '/sports/itf/games',
        label: 'ITF',
        source: { menuSlug: 'itf' },
      },
      {
        type: 'link',
        href: '/sports/wta-doubles/games',
        label: 'WTA Doubles',
        source: { menuSlug: 'wta-doubles' },
      },
      {
        type: 'link',
        href: '/sports/atp-doubles/games',
        label: 'ATP Doubles',
        source: { menuSlug: 'atp-doubles' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/cricket/games',
    menuSlug: 'cricket',
    source: { id: 'top-link-cricket-sports-crint-games-16' },
    label: 'Cricket',
    links: [
      {
        type: 'link',
        href: '/sports/cricket/games',
        label: 'All',
        source: { menuSlug: 'cricket' },
      },
      {
        type: 'link',
        href: '/sports/crict20lpl/games',
        label: 'Lanka Premier League',
        source: { menuSlug: 'crict20lpl' },
      },
      {
        type: 'link',
        href: '/sports/crint/games',
        label: 'International',
        source: { menuSlug: 'crint' },
      },
      {
        type: 'link',
        href: '/sports/crichundred/games',
        label: 'The Hundred',
        source: { menuSlug: 'crichundred' },
      },
      {
        type: 'link',
        href: '/sports/cricgsl/games',
        label: 'Global Super League',
        source: { menuSlug: 'cricgsl' },
      },
      {
        type: 'link',
        href: '/sports/cricmukono/games',
        label: 'Mukono Super Smash',
        source: { menuSlug: 'cricmukono' },
      },
      {
        type: 'link',
        href: '/sports/cricodc/games',
        label: 'One Day Cup',
        source: { menuSlug: 'cricodc' },
      },
      {
        type: 'link',
        href: '/sports/cricodcl2w/games',
        label: 'One Day Cup L2 (W)',
        source: { menuSlug: 'cricodcl2w' },
      },
      {
        type: 'link',
        href: '/sports/crickerala/games',
        label: 'Kuwait Kerala PL',
        source: { menuSlug: 'crickerala' },
      },
      {
        type: 'link',
        href: '/sports/cricjclt10/games',
        label: 'JCL T10',
        source: { menuSlug: 'cricjclt10' },
      },
      {
        type: 'link',
        href: '/sports/crichundredw/games',
        label: 'The Hundred (W)',
        source: { menuSlug: 'crichundredw' },
      },
      {
        type: 'link',
        href: '/sports/cricmaharani/games',
        label: 'Maharani Trophy',
        source: { menuSlug: 'cricmaharani' },
      },
      {
        type: 'link',
        href: '/sports/cricecseng/games',
        label: 'ECS England',
        source: { menuSlug: 'cricecseng' },
      },
      {
        type: 'link',
        href: '/sports/criccpl/games',
        label: 'Caribbean Premier League',
        source: { menuSlug: 'criccpl' },
      },
      {
        type: 'link',
        href: '/sports/cricgermant10/games',
        label: 'German Super League',
        source: { menuSlug: 'cricgermant10' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/basketball/games',
    menuSlug: 'basketball',
    source: { id: 'group-basketball-10' },
    label: 'Basketball',
    links: [
      {
        type: 'link',
        href: '/sports/basketball/games',
        label: 'All',
        source: { menuSlug: 'basketball' },
      },
      {
        type: 'link',
        href: '/sports/wnba/games',
        label: 'WNBA',
        source: { menuSlug: 'wnba' },
      },
      {
        type: 'link',
        href: '/sports/nba/games',
        label: 'NBA',
        source: { menuSlug: 'nba' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/baseball/games',
    menuSlug: 'baseball',
    source: { id: 'group-baseball-14' },
    label: 'Baseball',
    links: [
      {
        type: 'link',
        href: '/sports/baseball/games',
        label: 'All',
        source: { menuSlug: 'baseball' },
      },
      {
        type: 'link',
        href: '/sports/mlb/games',
        label: 'MLB',
        source: { menuSlug: 'mlb' },
      },
      {
        type: 'link',
        href: '/sports/kbo/games',
        label: 'KBO',
        source: { menuSlug: 'kbo' },
      },
      {
        type: 'link',
        href: '/sports/cpbl/games',
        label: 'CPBL',
        source: { menuSlug: 'cpbl' },
      },
      {
        type: 'link',
        href: '/sports/npb/games',
        label: 'NPB',
        source: { menuSlug: 'npb' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/football/games',
    menuSlug: 'football',
    source: { id: 'group-football-9' },
    label: 'Football',
    links: [
      {
        type: 'link',
        href: '/sports/football/games',
        label: 'All',
        source: { menuSlug: 'football' },
      },
      {
        type: 'link',
        href: '/sports/cfl/games',
        label: 'CFL',
        source: { menuSlug: 'cfl' },
      },
      {
        type: 'link',
        href: '/sports/nfl',
        label: 'NFL',
        source: { menuSlug: 'nfl' },
      },
      {
        type: 'link',
        href: '/sports/cfb/props',
        label: 'College Football',
        source: { menuSlug: 'cfb' },
      },
    ],
  },
  {
    type: 'link',
    href: '/sports/nhl/games',
    source: { id: 'top-link-nhl-sports-nhl-games-6' },
    label: 'Hockey',
    menuSlug: 'nhl',
  },
  {
    type: 'group',
    href: '/sports/rugby/games',
    menuSlug: 'rugby',
    source: { id: 'group-rugby-17' },
    label: 'Rugby',
    links: [
      {
        type: 'link',
        href: '/sports/rugby/games',
        label: 'All',
        source: { menuSlug: 'rugby' },
      },
      {
        type: 'link',
        href: '/sports/rlnrl/games',
        label: 'NRL',
        source: { menuSlug: 'rlnrl' },
      },
      {
        type: 'link',
        href: '/sports/rlsuper/games',
        label: 'Super League',
        source: { menuSlug: 'rlsuper' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/table-tennis/games',
    menuSlug: 'table-tennis',
    source: { id: 'group-table-tennis-18' },
    label: 'Table Tennis',
    links: [
      {
        type: 'link',
        href: '/sports/table-tennis/games',
        label: 'All',
        source: { menuSlug: 'table-tennis' },
      },
      {
        type: 'link',
        href: '/sports/setkameua/games',
        label: 'Setka Cup UA (M)',
        source: { menuSlug: 'setkameua' },
      },
      {
        type: 'link',
        href: '/sports/setkamecz/games',
        label: 'Setka Cup CZ (M)',
        source: { menuSlug: 'setkamecz' },
      },
      {
        type: 'link',
        href: '/sports/setkamemd/games',
        label: 'Setka Cup MD (M)',
        source: { menuSlug: 'setkamemd' },
      },
      {
        type: 'link',
        href: '/sports/setkawoua/games',
        label: 'Setka Cup UA (W)',
        source: { menuSlug: 'setkawoua' },
      },
    ],
  },
  {
    type: 'link',
    href: '/sports/vbvnl/games',
    source: { id: 'sports-top-link-volleyball' },
    label: 'Volleyball',
    menuSlug: 'vbvnl',
  },
  {
    type: 'group',
    href: '/sports/golf/props',
    menuSlug: 'golf',
    source: { id: 'top-link-golf-sports-golf-props-19' },
    label: 'Golf',
    links: [
      {
        type: 'link',
        href: '/sports/golf/props',
        label: 'All',
        source: { menuSlug: 'golf' },
      },
      {
        type: 'link',
        href: '/sports/pga/props',
        label: 'PGA',
        source: { menuSlug: 'pga' },
      },
      {
        type: 'link',
        href: '/sports/lpga/props',
        label: 'LPGA',
        source: { menuSlug: 'lpga' },
      },
      {
        type: 'link',
        href: '/sports/liv/props',
        label: 'LIV Golf',
        source: { menuSlug: 'liv' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/mma/games',
    menuSlug: 'mma',
    source: { id: 'group-ufc-7' },
    label: 'Combat',
    links: [
      {
        type: 'link',
        href: '/sports/mma/games',
        label: 'All',
        source: { menuSlug: 'mma' },
      },
      {
        type: 'link',
        href: '/sports/ufc/games',
        label: 'UFC',
        source: { menuSlug: 'ufc' },
      },
      {
        type: 'link',
        href: '/sports/powerslap/games',
        label: 'Power Slap',
        source: { menuSlug: 'powerslap' },
      },
      {
        type: 'link',
        href: '/sports/boxing/props',
        label: 'Boxing',
        source: { menuSlug: 'boxing' },
      },
    ],
  },
  {
    type: 'group',
    href: '/sports/motorsports/props',
    menuSlug: 'motorsports',
    source: { id: 'sidebar-default-motorsports' },
    label: 'Motorsports',
    links: [
      {
        type: 'link',
        href: '/sports/motorsports/props',
        label: 'All',
        source: { menuSlug: 'motorsports' },
      },
      {
        type: 'link',
        href: '/sports/f1/props',
        label: 'Formula 1',
        source: { menuSlug: 'f1' },
      },
      {
        type: 'link',
        href: '/sports/indycar/props',
        label: 'IndyCar',
        source: { menuSlug: 'indycar' },
      },
      {
        type: 'link',
        href: '/sports/nascar/props',
        label: 'NASCAR',
        source: { menuSlug: 'nascar' },
      },
    ],
  },
  {
    type: 'link',
    href: '/sports/cycling/props',
    source: { id: 'sidebar-default-cycling' },
    label: 'Cycling',
    menuSlug: 'cycling',
  },
  {
    type: 'link',
    href: '/sports/poker/props',
    source: { id: 'sidebar-default-poker' },
    label: 'Poker',
    menuSlug: 'poker',
  },
  {
    type: 'link',
    href: '/sports/chess/games',
    source: { id: 'top-link-chess-sports-chess-props-21' },
    label: 'Chess',
    menuSlug: 'chess',
  },
  {
    type: 'link',
    href: '/sports/pickleball/games',
    source: { id: 'top-link-pickleball-sports-pickleball-props-23' },
    label: 'Pickleball',
    menuSlug: 'pickleball',
  },
  {
    type: 'group',
    href: '/sports/lacrosse/games',
    menuSlug: 'lacrosse',
    source: { id: 'group-lacrosse-24' },
    label: 'Lacrosse',
    links: [
      {
        type: 'link',
        href: '/sports/lacrosse/games',
        label: 'All',
        source: { menuSlug: 'lacrosse' },
      },
      {
        type: 'link',
        href: '/sports/pll/games',
        label: 'Premier Lacrosse League',
        source: { menuSlug: 'pll' },
      },
      {
        type: 'link',
        href: '/sports/wll/games',
        label: "Women's Lacrosse League",
        source: { menuSlug: 'wll' },
      },
    ],
  },
  {
    type: 'link',
    href: '/esports',
    source: { id: 'sports-top-link-esports' },
    label: 'Esports',
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
      {
        type: 'link',
        source: { id: 'group-esports-mobile-legends-bang-bang-betboom-rise-of-legends' },
        menuSlug: null,
      },
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

  return (
    rows.find((row) => {
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
  )
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

function toLinkEntry(rows: SportsMenuSidebarRow[], spec: SidebarLinkSpec): SportsMenuLinkEntry | null {
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
    menuSlug: spec.menuSlug === undefined ? normalizeComparableValue(row?.menu_slug) : spec.menuSlug,
  }
}

function toGroupEntry(rows: SportsMenuSidebarRow[], spec: SidebarGroupSpec): SportsMenuGroupEntry | null {
  const row = findRow(rows, spec.source, 'group')
  if (!row || !row.label || !row.icon_url) {
    return null
  }

  const iconRow = findRow(rows, spec.iconSource, 'group') ?? findRow(rows, spec.iconSource, 'link')
  const links = spec.links
    .map((linkSpec) => toLinkEntry(rows, linkSpec))
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
  return (a.sidebar_sort_order ?? 0) - (b.sidebar_sort_order ?? 0) || a.id.localeCompare(b.id)
}

function compareChildRows(a: SportsMenuSidebarRow, b: SportsMenuSidebarRow) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id)
}

function isRetiredSportsMenuRow(row: SportsMenuSidebarRow) {
  const menuSlug = normalizeComparableValue(row.menu_slug)
  const href = row.href?.split(/[?#]/)[0]?.replace(/\/+$/, '') ?? ''

  return (
    menuSlug === 'world-cup' ||
    menuSlug === 'futures' ||
    href === '/sports/world-cup' ||
    href.startsWith('/sports/world-cup/') ||
    href === '/sports/futures' ||
    href.startsWith('/sports/futures/')
  )
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

function toConfiguredGroupEntry(row: SportsMenuSidebarRow, rows: SportsMenuSidebarRow[]): SportsMenuGroupEntry | null {
  if ((row.item_type !== 'group' && row.item_type !== 'link') || !row.label || !row.icon_url) {
    return null
  }

  const childLinks = rows
    .filter((candidate) => candidate.parent_id === row.id && candidate.sidebar_enabled === true)
    .sort(compareChildRows)
    .map(toConfiguredLinkEntry)
    .filter((entry): entry is SportsMenuLinkEntry => Boolean(entry))
  const parentLink = row.item_type === 'link' ? toConfiguredLinkEntry(row) : null
  const links =
    parentLink && !childLinks.some((link) => link.href === parentLink.href)
      ? [{ ...parentLink, id: `${parentLink.id}-all`, label: 'All' }, ...childLinks]
      : childLinks
  if (links.length === 0) {
    return null
  }

  const menuSlug = normalizeComparableValue(row.menu_slug) || slugifyText(row.label)
  const landingLink = links.find((link) => link.menuSlug === menuSlug) ?? links[0]

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
  const hasEnabledChildren = rows.some(
    (candidate) =>
      candidate.parent_id === row.id && candidate.item_type === 'link' && candidate.sidebar_enabled === true,
  )
  if (row.item_type === 'group' || hasEnabledChildren) {
    return toConfiguredGroupEntry(row, rows)
  }

  return toConfiguredLinkEntry(row)
}

function buildConfiguredSportsSidebarEntries(rows: SportsMenuSidebarRow[], vertical: SportsVertical) {
  const spec = vertical === 'esports' ? esportsSidebarSpec : sportsSidebarSpec
  const verticalRows = rows.filter(
    (row) => isMenuRowForVertical(row, vertical) && (vertical !== 'sports' || !isRetiredSportsMenuRow(row)),
  )
  const systemEntries = spec.slice(0, 4).flatMap((item): SportsMenuEntry[] => {
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

  const enabledCategories = verticalRows.filter((row) => row.sidebar_category && row.sidebar_enabled)
  const featuredEntries = enabledCategories
    .filter((row) => row.sidebar_featured)
    .sort(compareConfiguredRows)
    .map((row) => toConfiguredEntry(row, verticalRows))
    .filter((entry): entry is SportsMenuLinkEntry | SportsMenuGroupEntry => Boolean(entry))
  const standardEntries = enabledCategories
    .filter((row) => !row.sidebar_featured && !row.parent_id)
    .sort(compareConfiguredRows)
    .map((row) => toConfiguredEntry(row, verticalRows))
    .filter((entry): entry is SportsMenuLinkEntry | SportsMenuGroupEntry => Boolean(entry))

  return [...systemEntries, ...featuredEntries, ...standardEntries]
}

export function buildSportsSidebarEntries(rows: SportsMenuSidebarRow[], vertical: SportsVertical): SportsMenuEntry[] {
  if (rows.some((row) => row.sidebar_category && isMenuRowForVertical(row, vertical))) {
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
