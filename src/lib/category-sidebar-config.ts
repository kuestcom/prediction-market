import type {
  PlatformCategorySidebarItem,
  PlatformCategorySidebarLinkItem,
  PlatformNavigationChild,
} from '@/lib/platform-navigation'

interface CategorySidebarTemplateLinkItem extends Omit<PlatformCategorySidebarLinkItem, 'count'> {
  includeInChilds?: boolean
  showCount?: boolean
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
    { type: 'link', slug: 'pre-market', label: 'Pre-Market', icon: 'pre-market' },
    { type: 'link', slug: 'etf', label: 'ETF', icon: 'etf' },
    { type: 'divider', key: 'crypto-assets' },
    { type: 'link', slug: 'bitcoin', label: 'Bitcoin', icon: 'bitcoin' },
    { type: 'link', slug: 'ethereum', label: 'Ethereum', icon: 'ethereum' },
    { type: 'link', slug: 'solana', label: 'Solana', icon: 'solana' },
    { type: 'link', slug: 'xrp', label: 'XRP', icon: 'xrp' },
    { type: 'link', slug: 'dogecoin', label: 'Dogecoin', icon: 'dogecoin' },
    { type: 'link', slug: 'microstrategy', label: 'Microstrategy', icon: 'microstrategy' },
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
    { type: 'link', slug: 'collectibles', label: 'Collectibles', icon: 'collectibles', showCount: false },
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
    { type: 'link', slug: 'earnings-calls', label: 'Earnings Calls', icon: 'earnings-calls', showCount: false },
    { type: 'link', slug: 'ipo', label: 'IPOs', icon: 'ipo' },
    { type: 'link', slug: 'fed-rates', label: 'Fed Rates', icon: 'fed-rates' },
    { type: 'link', slug: 'prediction-markets', label: 'Prediction Markets', icon: 'prediction-markets' },
    { type: 'link', slug: 'treasuries', label: 'Treasuries', icon: 'treasuries' },
  ],
}

function isLinkItem(item: CategorySidebarTemplateItem): item is CategorySidebarTemplateLinkItem {
  return item.type === 'link'
}

export function resolveCategorySidebarData({
  categoryCount,
  categorySlug,
  childs,
}: ResolveCategorySidebarDataParams): CategorySidebarResolutionResult {
  const template = categorySidebarTemplates[categorySlug]
  if (!template) {
    return { childs }
  }

  const childsBySlug = new Map(childs.map(child => [child.slug, child]))
  const configuredSlugs = new Set(
    template
      .filter(isLinkItem)
      .filter(item => !item.isAll)
      .map(item => item.slug),
  )

  const configuredChilds = template
    .filter(isLinkItem)
    .filter(item => !item.isAll)
    .filter(item => item.includeInChilds !== false)
    .map(item => ({
      slug: item.slug,
      name: item.label,
      count: childsBySlug.get(item.slug)?.count ?? 0,
    }))

  const remainingChilds = childs.filter(child => !configuredSlugs.has(child.slug))

  return {
    childs: [...configuredChilds, ...remainingChilds],
    sidebarItems: template.map((item) => {
      if (item.type === 'divider') {
        return item
      }

      return {
        type: 'link',
        slug: item.slug,
        label: item.label,
        count: item.showCount === false
          ? undefined
          : item.isAll
            ? categoryCount
            : (childsBySlug.get(item.slug)?.count ?? 0),
        href: item.href,
        icon: item.icon,
        isAll: item.isAll,
      }
    }),
  }
}
