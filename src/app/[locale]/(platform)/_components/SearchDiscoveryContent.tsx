'use client'

import type { PredictionResultsSortOption } from '@/lib/prediction-results-filters'
import {
  ClockFadingIcon,
  DropletIcon,
  FlameIcon,
  HandFistIcon,
  SparkleIcon,
  TrendingUpIcon,
  XIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import EventIconImage from '@/components/EventIconImage'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { useRecentSearchEvents } from '@/hooks/useRecentSearchEvents'
import {
  buildPredictionResultsUrlSearchParams,
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
} from '@/lib/prediction-results-filters'
import { cn } from '@/lib/utils'

interface SearchDiscoveryContentProps {
  onNavigate?: () => void
  variant?: 'desktop' | 'mobile'
}

function buildPredictionBrowseHref(
  baseSlug: string,
  sort: PredictionResultsSortOption = DEFAULT_PREDICTION_RESULTS_SORT,
) {
  const params = buildPredictionResultsUrlSearchParams('', {
    sort,
    status: DEFAULT_PREDICTION_RESULTS_STATUS,
  })
  const queryString = params.toString()

  return queryString
    ? `/predictions/${baseSlug}?${queryString}`
    : `/predictions/${baseSlug}`
}

function resolveSearchTopicHref(slug: string) {
  if (slug === 'live-crypto') {
    return '/predictions/up-or-down'
  }

  if (slug === 'sports') {
    return '/sports/live'
  }

  return `/predictions/${slug}`
}

const SEARCH_TOPIC_ORDER = [
  {
    slug: 'live-crypto',
    fallbackLabel: 'Live Crypto',
    imageSrc: '/images/topics/nav-live-crypto.webp',
  },
  {
    slug: 'politics',
    fallbackLabel: 'Politics',
    imageSrc: '/images/topics/nav-markets-politics.webp',
  },
  {
    slug: 'middle-east',
    fallbackLabel: 'Middle East',
    imageSrc: '/images/topics/nav-markets-middle-east.webp',
  },
  {
    slug: 'crypto',
    fallbackLabel: 'Crypto',
    imageSrc: '/images/topics/nav-markets-crypto.webp',
  },
  {
    slug: 'sports',
    fallbackLabel: 'Sports',
    imageSrc: '/images/topics/nav-nba.webp',
  },
  {
    slug: 'pop-culture',
    fallbackLabel: 'Pop Culture',
    imageSrc: '/images/topics/nav-markets-pop-culture.webp',
  },
  {
    slug: 'tech',
    fallbackLabel: 'Tech',
    imageSrc: '/images/topics/nav-markets-tech.webp',
  },
  {
    slug: 'ai',
    fallbackLabel: 'AI',
    imageSrc: '/images/topics/nav-markets-ai.webp',
  },
] as const

export default function SearchDiscoveryContent({
  onNavigate,
  variant = 'mobile',
}: SearchDiscoveryContentProps) {
  const t = useExtracted()
  const { tags } = usePlatformNavigationData()
  const { recentEvents, removeRecentSearchEvent } = useRecentSearchEvents()
  const isDesktop = variant === 'desktop'

  const browseLinks = [
    { href: buildPredictionBrowseHref('trending'), icon: TrendingUpIcon, label: t('Trending') },
    { href: buildPredictionBrowseHref('new'), icon: SparkleIcon, label: t('New') },
    { href: buildPredictionBrowseHref('trending', 'volume'), icon: FlameIcon, label: t('Popular') },
    { href: '/', icon: DropletIcon, label: t('Liquidity') },
    { href: buildPredictionBrowseHref('trending', 'ending-soon'), icon: ClockFadingIcon, label: t('Ending Soon') },
    { href: buildPredictionBrowseHref('trending', 'competitive'), icon: HandFistIcon, label: t('Competitive') },
  ] as const

  const topicLabelsBySlug = new Map([
    ...tags.map(tag => [tag.slug, tag.name] as const),
    ...tags.flatMap(tag => tag.childs.map(child => [child.slug, child.name] as const)),
  ])

  const topicItems = SEARCH_TOPIC_ORDER.map(item => ({
    ...item,
    href: resolveSearchTopicHref(item.slug),
    label: topicLabelsBySlug.get(item.slug) ?? item.fallbackLabel,
  }))

  return (
    <div
      className={cn(
        'grid',
        isDesktop ? 'gap-6 p-4' : 'mt-5 gap-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]',
      )}
    >
      <section className="grid gap-3">
        <p
          className={cn(
            'font-semibold tracking-[0.22em] text-muted-foreground uppercase',
            isDesktop ? 'text-[11px]' : 'text-2xs',
          )}
        >
          {t('Browse')}
        </p>
        <div className={cn('flex flex-wrap', isDesktop ? 'gap-2.5' : 'gap-2')}>
          {browseLinks.map(link => (
            <IntentPrefetchLink
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                `
                  inline-flex items-center border border-border/70 font-normal transition-colors
                  hover:bg-accent hover:text-accent-foreground
                `,
                isDesktop
                  ? 'gap-1.75 rounded-md px-3 py-1.5 text-[13px]'
                  : 'gap-1.5 rounded-sm px-2.25 py-1 text-xs',
              )}
            >
              <link.icon className={cn(isDesktop ? 'size-3.5' : 'size-3.5')} />
              {link.label}
            </IntentPrefetchLink>
          ))}
        </div>
      </section>

      {recentEvents.length > 0 && (
        <section className={cn('grid', isDesktop ? 'gap-3' : 'gap-2')}>
          <p
            className={cn(
              'font-semibold tracking-[0.22em] text-muted-foreground uppercase',
              isDesktop ? 'text-[11px]' : 'text-2xs',
            )}
          >
            {t('Recent')}
          </p>
          <div className="grid gap-1">
            {recentEvents.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center rounded-md transition-colors hover:bg-accent',
                  isDesktop ? 'gap-2' : 'gap-1.5',
                )}
              >
                <IntentPrefetchLink
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex min-w-0 flex-1 items-center',
                    isDesktop ? 'gap-3 px-1.5 py-2' : 'gap-2 px-1 py-1.5',
                  )}
                >
                  <div
                    className={cn(
                      'shrink-0 overflow-hidden',
                      isDesktop ? 'size-8 rounded-md' : 'size-6 rounded-sm',
                    )}
                  >
                    {item.iconUrl
                      ? (
                          <EventIconImage
                            src={item.iconUrl}
                            alt={item.title}
                            sizes={isDesktop ? '32px' : '24px'}
                            containerClassName="size-full"
                          />
                        )
                      : (
                          <div className="size-full bg-muted" />
                        )}
                  </div>
                  <p
                    className={cn(
                      'min-w-0 truncate font-normal text-foreground',
                      isDesktop ? 'text-sm' : 'text-xs/tight',
                    )}
                  >
                    {item.title}
                  </p>
                </IntentPrefetchLink>

                <button
                  type="button"
                  aria-label={t('Remove')}
                  className={cn(
                    `
                      inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground
                      transition-colors
                      hover:text-foreground
                    `,
                    isDesktop ? 'size-8' : 'size-7',
                  )}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    removeRecentSearchEvent(item.id)
                  }}
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {topicItems.length > 0 && (
        <section className={cn('grid', isDesktop ? 'gap-4' : 'gap-3')}>
          <p
            className={cn(
              'font-semibold tracking-[0.22em] text-muted-foreground uppercase',
              isDesktop ? 'text-[11px]' : 'text-2xs',
            )}
          >
            {t('Topics')}
          </p>
          <div className={cn('grid grid-cols-2', isDesktop ? 'gap-2.5' : 'gap-2')}>
            {topicItems.map(item => (
              <IntentPrefetchLink
                key={item.slug}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  `
                    flex items-center border border-border/70 transition-colors
                    hover:bg-accent hover:text-accent-foreground
                  `,
                  isDesktop
                    ? 'gap-2.5 rounded-xl px-2.25 py-1.75'
                    : 'gap-2 rounded-lg px-1.5 py-1.25',
                )}
              >
                <div
                  className={cn(
                    'relative shrink-0 overflow-hidden',
                    isDesktop ? 'size-9.5 rounded-lg' : 'size-6.5 rounded-md',
                  )}
                >
                  <Image
                    src={item.imageSrc}
                    alt={item.label}
                    fill
                    sizes={isDesktop ? '38px' : '26px'}
                    className="object-cover"
                  />
                </div>

                <p
                  className={cn(
                    'min-w-0 truncate font-normal text-foreground',
                    isDesktop ? 'text-sm/tight' : 'text-xs/tight',
                  )}
                >
                  {item.label}
                </p>
              </IntentPrefetchLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
