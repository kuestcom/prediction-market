import type {
  PlatformCategorySidebarItem,
  PlatformCategorySidebarLinkItem,
  PlatformNavigationChild,
} from '@/lib/platform-navigation'

interface CategorySidebarTemplateSubItem extends Omit<PlatformCategorySidebarLinkItem, 'count' | 'subItems'> {
  includeInChilds?: boolean
  showCount?: boolean
}

interface CategorySidebarTemplateLinkItem extends Omit<PlatformCategorySidebarLinkItem, 'count' | 'subItems'> {
  includeInChilds?: boolean
  showCount?: boolean
  subItems?: CategorySidebarTemplateSubItem[]
}

interface CategorySidebarTemplateDividerItem {
  type: 'divider'
  key: string
}

type CategorySidebarTemplateItem = CategorySidebarTemplateLinkItem | CategorySidebarTemplateDividerItem

interface CategorySidebarResolutionResult {
  childs: PlatformNavigationChild[]
  sidebarItems?: PlatformCategorySidebarItem[]
}

interface ResolveCategorySidebarDataParams {
  categoryCount: number
  categorySlug: string
  childs: PlatformNavigationChild[]
}

interface ResolveCategorySidebarPageTitleParams {
  activeSubcategorySlug: string | null
  categorySlug: string
  categoryTitle: string
  childs: PlatformNavigationChild[]
}

const CRYPTO_CADENCE_PAGE_TITLE_SLUGS = new Set([
  '5m',
  '15m',
  'hourly',
  '4hour',
  'daily',
  'weekly',
  'monthly',
  'yearly',
])

const categorySidebarTemplates: Partial<Record<string, CategorySidebarTemplateItem[]>> = {
  crypto: [
    { type: 'link', slug: 'crypto', label: 'All', icon: 'all-grid', isAll: true },
    { type: 'link', slug: '5M', label: '5 Min', icon: 'five-minute' },
    { type: 'link', slug: '15M', label: '15 Min', icon: 'fifteen-minute' },
    { type: 'link', slug: 'hourly', label: '1 Hour', icon: 'hourly' },
    { type: 'link', slug: '4hour', label: '4 Hours', icon: 'four-hour' },
    { type: 'link', slug: 'daily', label: 'Daily', icon: 'daily' },
    { type: 'link', slug: 'weekly', label: 'Weekly', icon: 'weekly' },
    { type: 'link', slug: 'monthly', label: 'Monthly', icon: 'monthly' },
    { type: 'link', slug: 'yearly', label: 'Yearly', icon: 'yearly' },
    { type: 'link', slug: 'targets', label: 'Targets', icon: 'targets' },
    { type: 'link', slug: 'pre-market', label: 'Pre-Market', icon: 'pre-market' },
    { type: 'link', slug: 'institutions', label: 'Institutions', icon: 'institutions' },
    { type: 'link', slug: 'industry', label: 'Industry', icon: 'industry' },
    { type: 'link', slug: 'protocol-metrics', label: 'Protocol Metrics', icon: 'protocol-metrics' },
    { type: 'divider', key: 'crypto-assets' },
    { type: 'link', slug: 'bitcoin', label: 'Bitcoin', icon: 'bitcoin' },
    { type: 'link', slug: 'ethereum', label: 'Ethereum', icon: 'ethereum' },
    { type: 'link', slug: 'solana', label: 'Solana', icon: 'solana' },
    { type: 'link', slug: 'xrp', label: 'XRP', icon: 'xrp' },
    { type: 'link', slug: 'dogecoin', label: 'Dogecoin', icon: 'dogecoin' },
    { type: 'link', slug: 'bnb', label: 'BNB', icon: 'bnb' },
    { type: 'link', slug: 'hype', label: 'HYPE', icon: 'hype' },
    { type: 'link', slug: 'microstrategy', label: 'MicroStrategy', icon: 'microstrategy' },
  ],
  finance: [
    { type: 'link', slug: 'finance', label: 'All', icon: 'all-grid', isAll: true },
    { type: 'link', slug: 'daily', label: 'Daily', icon: 'daily' },
    { type: 'link', slug: 'weekly', label: 'Weekly', icon: 'weekly' },
    { type: 'link', slug: 'monthly', label: 'Monthly', icon: 'monthly' },
    { type: 'divider', key: 'finance-assets' },
    { type: 'link', slug: 'stocks', label: 'Stocks', icon: 'stocks' },
    { type: 'link', slug: 'earnings', label: 'Earnings', icon: 'earnings' },
    { type: 'link', slug: 'indicies', label: 'Indices', icon: 'indicies' },
    { type: 'link', slug: 'commodities', label: 'Commodities', icon: 'commodities' },
    { type: 'link', slug: 'forex', label: 'Forex', icon: 'forex' },
    { type: 'link', slug: 'privates', label: 'Privates', icon: 'privates' },
    { type: 'link', slug: 'acquisitions', label: 'Acquisitions', icon: 'acquisitions' },
    {
      type: 'link',
      slug: 'earnings-calendar',
      label: 'Earnings Calendar',
      href: '/earnings',
      icon: 'earnings-calendar',
      includeInChilds: false,
      showCount: false,
    },
    { type: 'link', slug: 'ipo', label: 'IPOs', icon: 'ipo' },
    { type: 'link', slug: 'fed-rates', label: 'Fed Rates', icon: 'fed-rates' },
    { type: 'link', slug: 'prediction-markets', label: 'Prediction Markets', icon: 'prediction-markets' },
    { type: 'link', slug: 'treasuries', label: 'Treasuries', icon: 'treasuries' },
    { type: 'link', slug: 'kpis', label: 'KPIs', icon: 'kpis' },
  ],
  weather: [
    { type: 'link', slug: 'weather', label: 'All', icon: 'all-grid', isAll: true },
    {
      type: 'link',
      slug: 'temperature',
      label: 'Temperature',
      icon: 'temperature',
      showCount: false,
      subItems: [
        { type: 'link', slug: 'high-temperature', label: 'High Temp', icon: 'high-temperature' },
        { type: 'link', slug: 'low-temperature', label: 'Low Temp', icon: 'low-temperature' },
      ],
    },
    { type: 'link', slug: 'precipitation', label: 'Precipitation', icon: 'precipitation' },
    { type: 'link', slug: 'global', label: 'Global', icon: 'global' },
    { type: 'link', slug: 'tornadoes', label: 'Tornadoes', icon: 'tornadoes' },
    { type: 'link', slug: 'hurricanes', label: 'Hurricanes', icon: 'hurricanes' },
    { type: 'link', slug: 'earthquakes', label: 'Earthquakes', icon: 'earthquakes' },
    { type: 'link', slug: 'volcanoes', label: 'Volcanoes', icon: 'volcanoes' },
    { type: 'link', slug: 'pandemics', label: 'Pandemics', icon: 'pandemics' },
  ],
}

function isLinkItem(item: CategorySidebarTemplateItem): item is CategorySidebarTemplateLinkItem {
  return item.type === 'link'
}

export function resolveCategorySidebarPageTitle({
  activeSubcategorySlug,
  categorySlug,
  categoryTitle,
  childs,
}: ResolveCategorySidebarPageTitleParams) {
  if (!activeSubcategorySlug) {
    return categoryTitle
  }

  const normalizedSubcategorySlug = activeSubcategorySlug.toLowerCase()
  const activeSubcategory = childs.find(child =>
    child.slug.toLowerCase() === normalizedSubcategorySlug,
  )
  if (!activeSubcategory) {
    return categoryTitle
  }

  const shouldAppendCrypto = categorySlug.toLowerCase() === 'crypto'
    && CRYPTO_CADENCE_PAGE_TITLE_SLUGS.has(normalizedSubcategorySlug)

  return shouldAppendCrypto
    ? `${activeSubcategory.name} ${categoryTitle}`
    : activeSubcategory.name
}

export function resolveCategorySidebarData({
  categoryCount,
  categorySlug,
  childs,
}: ResolveCategorySidebarDataParams): CategorySidebarResolutionResult {
  const template = categorySidebarTemplates[categorySlug]
  if (!template) {
    return {
      childs,
      sidebarItems: [
        {
          type: 'link',
          slug: categorySlug,
          label: 'All',
          count: categoryCount,
          isAll: true,
        },
        ...childs.map(child => ({
          type: 'link' as const,
          slug: child.slug,
          label: child.name,
          count: child.count,
        })),
      ],
    }
  }

  const childsBySlug = new Map(childs.map(child => [child.slug, child]))
  const configuredLinkItems = template
    .filter(isLinkItem)
    .flatMap(item => [item, ...(item.subItems ?? [])])

  const configuredSlugs = new Set(
    configuredLinkItems
      .filter(item => !item.isAll)
      .map(item => item.slug),
  )

  const configuredChilds = configuredLinkItems
    .filter(item => !item.isAll)
    .filter(item => item.includeInChilds !== false)
    .map(item => ({
      slug: item.slug,
      name: childsBySlug.get(item.slug)?.name ?? item.label,
      count: childsBySlug.get(item.slug)?.count ?? 0,
    }))

  const remainingChilds = childs.filter(child => !configuredSlugs.has(child.slug))

  function resolveLinkItem(
    item: CategorySidebarTemplateLinkItem | CategorySidebarTemplateSubItem,
  ): PlatformCategorySidebarLinkItem {
    return {
      type: 'link',
      slug: item.slug,
      label: childsBySlug.get(item.slug)?.name ?? item.label,
      count: item.showCount === false
        ? undefined
        : item.isAll
          ? categoryCount
          : (childsBySlug.get(item.slug)?.count ?? 0),
      href: item.href,
      icon: item.icon,
      isAll: item.isAll,
      subItems: 'subItems' in item
        ? item.subItems?.map(resolveLinkItem)
        : undefined,
    }
  }

  return {
    childs: [...configuredChilds, ...remainingChilds],
    sidebarItems: template.map((item) => {
      if (item.type === 'divider') {
        return item
      }

      return resolveLinkItem(item)
    }),
  }
}
