'use client'

import type { ReactNode } from 'react'
import type {
  PlatformCategorySidebarIconKey,
  PlatformCategorySidebarItem,
  PlatformCategorySidebarLinkItem,
  PlatformNavigationChild,
} from '@/lib/platform-navigation'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { cn } from '@/lib/utils'

interface CategorySidebarProps {
  activeSubcategorySlug: string | null
  categorySlug: string
  categoryTitle: string
  onNavigate: (target: Pick<PlatformCategorySidebarLinkItem, 'href' | 'slug'>) => void
  sidebarItems?: PlatformCategorySidebarItem[]
  subcategories: PlatformNavigationChild[]
}

interface CategorySidebarLinkProps {
  children: ReactNode
  count?: number
  href: string
  icon?: PlatformCategorySidebarIconKey
  isActive: boolean
  onClick: () => void
}

interface SidebarIconAsset {
  alt: string
  decorative?: boolean
  rounded?: boolean
  src: string
}

interface CategorySidebarRenderLinkItem extends PlatformCategorySidebarLinkItem {}

type CategorySidebarRenderItem
  = | CategorySidebarRenderLinkItem
    | Extract<PlatformCategorySidebarItem, { type: 'divider' }>

const sidebarIconAssets: Record<PlatformCategorySidebarIconKey, SidebarIconAsset> = {
  'all-grid': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/all-grid.svg',
  },
  'five-minute': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/five-minute.svg',
  },
  'fifteen-minute': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/fifteen-minute.svg',
  },
  'hourly': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/hourly.svg',
  },
  'four-hour': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/four-hour.svg',
  },
  'daily': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/daily.svg',
  },
  'weekly': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/weekly.svg',
  },
  'monthly': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/monthly.svg',
  },
  'yearly': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/yearly.svg',
  },
  'pre-market': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/pre-market.svg',
  },
  'etf': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/crypto/etf.svg',
  },
  'bitcoin': {
    alt: 'Bitcoin logo',
    rounded: true,
    src: '/images/logos/btc.png',
  },
  'ethereum': {
    alt: 'Ethereum logo',
    rounded: true,
    src: '/images/logos/eth.png',
  },
  'solana': {
    alt: 'Solana logo',
    rounded: true,
    src: '/images/logos/sol.png',
  },
  'xrp': {
    alt: 'XRP logo',
    rounded: true,
    src: '/images/logos/xrp.png',
  },
  'dogecoin': {
    alt: 'Dogecoin logo',
    rounded: true,
    src: '/images/logos/doge.png',
  },
  'microstrategy': {
    alt: 'Microstrategy logo',
    rounded: true,
    src: '/images/logos/microstrategy.jpg',
  },
  'stocks': {
    alt: 'Stocks',
    src: '/images/category-sidebar/finance/stocks.png',
  },
  'earnings': {
    alt: 'Earnings',
    src: '/images/category-sidebar/finance/earnings.png',
  },
  'indicies': {
    alt: 'Indices',
    src: '/images/category-sidebar/finance/indices.png',
  },
  'commodities': {
    alt: 'Commodities',
    src: '/images/category-sidebar/finance/commodities.png',
  },
  'forex': {
    alt: 'Forex',
    src: '/images/category-sidebar/finance/forex.png',
  },
  'collectibles': {
    alt: 'Collectibles',
    src: '/images/category-sidebar/finance/collectibles.png',
  },
  'acquisitions': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/acquisitions.svg',
  },
  'earnings-calendar': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/earnings-calendar.svg',
  },
  'earnings-calls': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/earnings-calls.svg',
  },
  'ipo': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/ipo.svg',
  },
  'fed-rates': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/fed-rates.svg',
  },
  'prediction-markets': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/prediction-markets.svg',
  },
  'treasuries': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/finance/treasuries.svg',
  },
  'temperature': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/temperature.svg',
  },
  'precipitation': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/precipitation.svg',
  },
  'global': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/global.svg',
  },
  'tornadoes': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/tornadoes.svg',
  },
  'hurricanes': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/hurricanes.svg',
  },
  'earthquakes': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/earthquakes.svg',
  },
  'volcanoes': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/volcanoes.svg',
  },
  'pandemics': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/pandemics.svg',
  },
  'space': {
    alt: '',
    decorative: true,
    src: '/images/category-sidebar/climate-science/space.svg',
  },
}

function SidebarLinkIcon({ icon }: { icon?: PlatformCategorySidebarIconKey }) {
  if (!icon) {
    return null
  }

  const asset = sidebarIconAssets[icon]

  return (
    <Image
      alt={asset.alt}
      aria-hidden={asset.decorative || undefined}
      src={asset.src}
      width={20}
      height={20}
      unoptimized={asset.src.endsWith('.svg')}
      className={cn('size-5', asset.rounded && 'rounded-full')}
    />
  )
}

function CategorySidebarLink({ children, count, href, icon, isActive, onClick }: CategorySidebarLinkProps) {
  return (
    <IntentPrefetchLink
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-md p-3 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-muted'
          : 'hover:bg-muted/60',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon && (
          <span className="shrink-0">
            <SidebarLinkIcon icon={icon} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </span>
      {typeof count === 'number' && (
        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </IntentPrefetchLink>
  )
}

export default function CategorySidebar({
  activeSubcategorySlug,
  categorySlug,
  categoryTitle,
  onNavigate,
  sidebarItems,
  subcategories,
}: CategorySidebarProps) {
  const t = useExtracted()
  const items: CategorySidebarRenderItem[] = sidebarItems ?? [
    {
      type: 'link',
      slug: categorySlug,
      label: t('All'),
      isAll: true,
    },
    ...subcategories.map(subcategory => ({
      type: 'link' as const,
      slug: subcategory.slug,
      label: subcategory.name,
      count: subcategory.count,
    })),
  ]

  return (
    <nav
      aria-label={`${categoryTitle} subcategories`}
      className={`
        hidden h-[calc(100vh-9rem)] w-47.5 shrink-0 flex-col overflow-y-auto py-5 [scrollbar-width:none]
        lg:sticky lg:top-32 lg:flex lg:py-0
        [&::-webkit-scrollbar]:hidden
      `}
    >
      {items.map((item) => {
        if (item.type === 'divider') {
          return <div key={item.key} className="mb-2 w-full border-b border-border pb-2" />
        }

        const isAllItem = item.isAll ?? item.slug === categorySlug
        const href = item.href ?? (isAllItem
          ? `/${categorySlug}`
          : `/${categorySlug}/${item.slug}`)

        return (
          <CategorySidebarLink
            key={item.slug}
            count={item.count}
            href={href}
            icon={item.icon}
            isActive={isAllItem ? activeSubcategorySlug === null : activeSubcategorySlug === item.slug}
            onClick={() => onNavigate({ slug: item.slug, href: item.href })}
          >
            {isAllItem ? t('All') : item.label}
          </CategorySidebarLink>
        )
      })}
    </nav>
  )
}
