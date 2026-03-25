export interface PlatformNavigationChild {
  name: string
  slug: string
  count?: number
}

export type PlatformCategorySidebarIconKey
  = | 'all-grid'
    | 'five-minute'
    | 'fifteen-minute'
    | 'hourly'
    | 'four-hour'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'pre-market'
    | 'etf'
    | 'bitcoin'
    | 'ethereum'
    | 'solana'
    | 'xrp'
    | 'bnb'
    | 'dogecoin'
    | 'microstrategy'
    | 'stocks'
    | 'earnings'
    | 'indicies'
    | 'commodities'
    | 'forex'
    | 'collectibles'
    | 'acquisitions'
    | 'earnings-calendar'
    | 'earnings-calls'
    | 'ipo'
    | 'fed-rates'
    | 'prediction-markets'
    | 'treasuries'
    | 'temperature'
    | 'precipitation'
    | 'global'
    | 'tornadoes'
    | 'hurricanes'
    | 'earthquakes'
    | 'volcanoes'
    | 'pandemics'
    | 'space'

export interface PlatformCategorySidebarLinkItem {
  type: 'link'
  slug: string
  label: string
  count?: number
  href?: string
  icon?: PlatformCategorySidebarIconKey
  isAll?: boolean
}

export type PlatformCategorySidebarItem
  = | PlatformCategorySidebarLinkItem
    | {
      type: 'divider'
      key: string
    }

export interface PlatformNavigationTag {
  slug: string
  name: string
  childs: PlatformNavigationChild[]
  sidebarItems?: PlatformCategorySidebarItem[]
}

export interface PlatformNavigationFilters {
  tag: string
  mainTag: string
  bookmarked: boolean
}

export interface PlatformPathState {
  isEventPathPage: boolean
  isHomeLikePage: boolean
  isHomePage: boolean
  isMainTagPathPage: boolean
  isMentionsPage: boolean
  isSportsPathPage: boolean
  selectedMainTagPathSlug: string | null
  selectedSubtagPathSlug: string | null
}

export interface ResolvedPlatformNavigationSelection {
  activeMainTagSlug: string
  activeTagSlug: string
  pathState: PlatformPathState
}

interface BuildPlatformNavigationTagsParams {
  globalChilds?: PlatformNavigationChild[]
  mainTags: PlatformNavigationTag[]
  newLabel: string
  trendingLabel: string
}

export function buildChildParentMap(tags: Array<Pick<PlatformNavigationTag, 'slug' | 'childs'>>) {
  return Object.fromEntries(
    tags.flatMap(tag => tag.childs.map(child => [child.slug, tag.slug])),
  ) as Record<string, string>
}

export function buildPlatformNavigationTags({
  mainTags,
  globalChilds = [],
  trendingLabel,
  newLabel,
}: BuildPlatformNavigationTagsParams): PlatformNavigationTag[] {
  const sharedChilds = globalChilds.map(child => ({ ...child }))
  const baseTags = mainTags.map(tag => ({
    ...tag,
    childs: (tag.childs ?? []).map(child => ({ ...child })),
  }))

  return [
    { slug: 'trending', name: trendingLabel, childs: sharedChilds },
    { slug: 'new', name: newLabel, childs: sharedChilds.map(child => ({ ...child })) },
    ...baseTags,
  ]
}

export function parsePlatformPathname(pathname: string, dynamicHomeCategorySlugSet: ReadonlySet<string>): PlatformPathState {
  const pathSegments = pathname.split('/').filter(Boolean)
  const isHomePage = pathname === '/'
  const isMentionsPage = pathname === '/mentions'
  const isEventPathPage = pathname.startsWith('/event/')

  if (pathSegments.length === 0) {
    return {
      isEventPathPage,
      isHomeLikePage: true,
      isHomePage,
      isMainTagPathPage: false,
      isMentionsPage,
      isSportsPathPage: false,
      selectedMainTagPathSlug: null,
      selectedSubtagPathSlug: null,
    }
  }

  const [candidate, subcategoryCandidate] = pathSegments
  if (candidate === 'sports') {
    return {
      isEventPathPage,
      isHomeLikePage: true,
      isHomePage,
      isMainTagPathPage: true,
      isMentionsPage,
      isSportsPathPage: true,
      selectedMainTagPathSlug: candidate,
      selectedSubtagPathSlug: null,
    }
  }

  const isDynamicHomeCategoryPath = dynamicHomeCategorySlugSet.has(candidate)
  const isNewPath = candidate === 'new'

  if (!isDynamicHomeCategoryPath && !isNewPath) {
    return {
      isEventPathPage,
      isHomeLikePage: isHomePage,
      isHomePage,
      isMainTagPathPage: false,
      isMentionsPage,
      isSportsPathPage: false,
      selectedMainTagPathSlug: null,
      selectedSubtagPathSlug: null,
    }
  }

  return {
    isEventPathPage,
    isHomeLikePage: true,
    isHomePage,
    isMainTagPathPage: true,
    isMentionsPage,
    isSportsPathPage: false,
    selectedMainTagPathSlug: candidate,
    selectedSubtagPathSlug: pathSegments.length === 2 ? subcategoryCandidate : null,
  }
}

export function resolvePlatformNavigationSelection({
  dynamicHomeCategorySlugSet,
  pathname,
  filters,
  childParentMap,
}: {
  childParentMap: Record<string, string>
  dynamicHomeCategorySlugSet: ReadonlySet<string>
  filters: PlatformNavigationFilters
  pathname: string
}): ResolvedPlatformNavigationSelection {
  const pathState = parsePlatformPathname(pathname, dynamicHomeCategorySlugSet)
  const showBookmarkedOnly = pathState.isHomeLikePage ? filters.bookmarked : false
  const rawTagFromFilters = pathState.isHomeLikePage
    ? (showBookmarkedOnly && filters.tag === 'trending' ? '' : filters.tag)
    : pathState.isMentionsPage
      ? 'mentions'
      : pathState.isEventPathPage
        ? filters.tag
        : 'trending'

  const activeTagSlug = pathState.isMainTagPathPage
    ? pathState.selectedSubtagPathSlug
      ? pathState.selectedSubtagPathSlug
      : (
          rawTagFromFilters === pathState.selectedMainTagPathSlug
          || filters.mainTag === pathState.selectedMainTagPathSlug
        )
          ? rawTagFromFilters
          : (pathState.selectedMainTagPathSlug ?? 'trending')
    : rawTagFromFilters

  const fallbackMainTag = filters.mainTag || childParentMap[activeTagSlug] || activeTagSlug || 'trending'
  const activeMainTagSlug = pathState.isMainTagPathPage
    ? pathState.selectedMainTagPathSlug || 'trending'
    : pathState.isHomePage
      ? 'trending'
      : pathState.isMentionsPage
        ? 'mentions'
        : pathState.isEventPathPage
          ? fallbackMainTag
          : 'trending'

  return {
    activeMainTagSlug,
    activeTagSlug,
    pathState,
  }
}
