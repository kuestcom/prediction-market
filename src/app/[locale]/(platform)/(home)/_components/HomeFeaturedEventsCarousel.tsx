'use client'

import type { IconName } from 'lucide-react/dynamic'
import type { CSSProperties } from 'react'
import type { SportsGamesMarketType } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-types'
import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type {
  HomeFeaturedContextItem,
  HomeFeaturedEventCard,
  HomeFeaturedHotTopic,
  HomeFeaturedOutcomeSummary,
  HomeFeaturedSideCardSettings,
  HomeFeaturedSportsMarketGroup,
} from '@/types'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FlameIcon,
} from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import EventChart from '@/app/[locale]/(platform)/event/[slug]/_components/EventChart'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import { shouldUseLiveSeriesChart } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventLiveSeriesChartEligibility'
import {
  buildSportsGamesCards,
  resolveSportsGamesCardCollapsedMarketType,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import AppLink from '@/components/AppLink'
import EventIconImage from '@/components/EventIconImage'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatDollarValueLabel, formatVolume } from '@/lib/formatters'
import { resolveSportsTeamFallbackClassName } from '@/lib/sports-team-colors'
import { cn } from '@/lib/utils'

interface HomeFeaturedEventsCarouselProps {
  items: HomeFeaturedEventCard[]
  hotTopics: HomeFeaturedHotTopic[]
  sideCard: HomeFeaturedSideCardSettings
}

const HOME_FEATURED_CHART_HEIGHT = 292
const HOME_FEATURED_CHART_HEIGHT_OFFSET = 20
const HOME_FEATURED_LIVE_CHART_WIDTH_OFFSET = 24
const HomeSportsGameGraph = dynamic(
  () => import('@/app/[locale]/(platform)/sports/_components/_sports-games-center/SportsGameGraph'),
  { ssr: false, loading: () => <div className="min-h-60 w-full md:min-h-[260px] lg:min-h-[280px]" /> },
)

const HomeEventLiveSeriesChart = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventLiveSeriesChart'),
  { ssr: false, loading: () => <div className="min-h-60 w-full md:min-h-[260px] lg:min-h-[280px]" /> },
)

function useElementWidth<T extends HTMLElement>(enabled = true) {
  const [element, setElement] = useState<T | null>(null)

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!enabled || !element) {
      return function noopElementWidthSubscription() {}
    }

    function notifyElementWidthChange() {
      onStoreChange()
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', notifyElementWidthChange)

      return function removeElementWidthResizeListener() {
        window.removeEventListener('resize', notifyElementWidthChange)
      }
    }

    const observer = new ResizeObserver(notifyElementWidthChange)
    observer.observe(element)

    return function disconnectElementWidthObserver() {
      observer.disconnect()
    }
  }, [enabled, element])

  const getSnapshot = useCallback(() => {
    if (!enabled || !element) {
      return undefined
    }

    const nextWidth = Math.round(element.getBoundingClientRect().width)
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
      return undefined
    }

    return nextWidth
  }, [enabled, element])

  const width = useSyncExternalStore(subscribe, getSnapshot, () => undefined)

  const ref = useCallback((node: T | null) => {
    if (!enabled) {
      setElement(currentElement => currentElement === null ? currentElement : null)
      return
    }

    setElement(currentElement => currentElement === node ? currentElement : node)
  }, [enabled])

  return [ref, width] as const
}

function formatChancePercent(chance: number) {
  return `${Math.round(chance)}%`
}

function formatVolumeLabel(volume: number) {
  return `${formatVolume(volume)} Vol`
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ') ?? ''
}

function isNegativeOutcomeLabel(label: string) {
  const normalized = normalizeText(label)
  return /\b(?:no|down|below|lower|under)\b/.test(normalized)
}

function resolveSportsButtonAppearance(market: HomeFeaturedSportsMarketGroup['markets'][number]) {
  if (market.tone === 'draw') {
    return {
      className: `
        border border-button-outline-border bg-transparent text-muted-foreground
        hover:bg-secondary/80 hover:text-foreground
      `,
      style: undefined,
      backgroundClassName: undefined,
      backgroundStyle: undefined,
    }
  }

  if (market.tone === 'neutral') {
    const normalizedLabel = normalizeText(market.label)
    if (normalizedLabel.startsWith('u ') || normalizedLabel.includes(' under')) {
      return {
        className: 'group/team-button text-no hover:bg-transparent',
        style: undefined,
        backgroundClassName: 'bg-no',
        backgroundStyle: undefined,
      }
    }
    if (normalizedLabel.startsWith('o ') || normalizedLabel.includes(' over')) {
      return {
        className: 'group/team-button text-yes hover:bg-transparent',
        style: undefined,
        backgroundClassName: 'bg-yes',
        backgroundStyle: undefined,
      }
    }

    return {
      className: 'border border-button-outline-border bg-transparent text-muted-foreground hover:bg-secondary/80',
      style: undefined,
      backgroundClassName: undefined,
      backgroundStyle: undefined,
    }
  }

  if (market.color) {
    const textColor = ensureReadableTextColorOnDark(market.color)

    return {
      className: 'group/team-button hover:bg-transparent',
      style: textColor ? { color: textColor } : undefined,
      backgroundClassName: undefined,
      backgroundStyle: { backgroundColor: market.color },
    }
  }

  return {
    className: 'group/team-button text-foreground hover:bg-transparent',
    style: undefined,
    backgroundClassName: resolveSportsTeamFallbackClassName(market.tone === 'home' ? 'team1' : 'team2'),
    backgroundStyle: undefined,
  }
}

function resolveSportsGraphSelection(card: SportsGamesCard): {
  selectedMarketType: SportsGamesMarketType
  selectedConditionId: string | null
} | null {
  const moneylineButton = card.buttons.find(button => button.marketType === 'moneyline')
  if (moneylineButton) {
    return {
      selectedMarketType: 'moneyline',
      selectedConditionId: null,
    }
  }

  const selectedMarketType = resolveSportsGamesCardCollapsedMarketType(card) ?? card.buttons[0]?.marketType
  if (!selectedMarketType) {
    return null
  }

  return {
    selectedMarketType,
    selectedConditionId: card.buttons.find(button => button.marketType === selectedMarketType)?.conditionId
      ?? card.defaultConditionId,
  }
}

function toTitleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function normalizePathSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || null
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

function resolveFeaturedBreadcrumbItems(item: HomeFeaturedEventCard) {
  const event = item.event
  const mainCategory = event.tags.find(tag => tag.isMainCategory) ?? null
  const mainSlug = normalizePathSlug(mainCategory?.slug ?? null)
    ?? normalizePathSlug(event.main_tag)
    ?? (item.kind === 'sports' ? 'sports' : null)

  if (item.kind === 'sports') {
    const sportsBasePath = mainSlug === 'esports' ? '/esports' : '/sports'
    const sportsSlug = normalizePathSlug(event.sports_sport_slug)
    const sportHref = sportsSlug ? `${sportsBasePath}/${sportsSlug}/games` : sportsBasePath

    return [
      {
        label: mainCategory?.name || event.main_tag || (mainSlug === 'esports' ? 'Esports' : 'Sports'),
        href: sportsBasePath,
      },
      ...(sportsSlug
        ? [{ label: toTitleCase(sportsSlug), href: sportHref }]
        : []),
    ]
  }

  if (!mainSlug) {
    return []
  }

  const secondaryTag = event.tags.find(tag => !tag.isMainCategory && normalizePathSlug(tag.slug) !== mainSlug) ?? null
  const recurrence = normalizePathSlug(event.series_recurrence)
  const secondarySlug = normalizePathSlug(secondaryTag?.slug ?? null) ?? recurrence
  const secondaryLabel = secondaryTag?.name || (recurrence ? toTitleCase(recurrence) : null)

  return [
    {
      label: mainCategory?.name || event.main_tag || toTitleCase(mainSlug),
      href: `/${mainSlug}`,
    },
    ...(secondarySlug && secondaryLabel
      ? [{ label: secondaryLabel, href: `/${mainSlug}/${secondarySlug}` }]
      : []),
  ]
}

function FeaturedBreadcrumb({ items }: { items: Array<{ label: string, href: string }> }) {
  if (items.length === 0) {
    return null
  }

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
      {items.map((breadcrumbItem, index) => (
        <span key={`${breadcrumbItem.href}:${breadcrumbItem.label}`} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && <span className="shrink-0 text-muted-foreground/60">·</span>}
          <AppLink
            intentPrefetch
            href={breadcrumbItem.href}
            className="truncate underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {breadcrumbItem.label}
          </AppLink>
        </span>
      ))}
    </nav>
  )
}

function FeaturedHeader({
  item,
  showActions = true,
}: {
  item: HomeFeaturedEventCard
  showActions?: boolean
}) {
  const t = useExtracted()
  const event = item.event
  const eventHref = resolveEventPagePath(event)
  const breadcrumbItems = resolveFeaturedBreadcrumbItems(item)

  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="group/header flex min-w-0 flex-1 items-start gap-3">
        <AppLink
          intentPrefetch
          href={eventHref}
          className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted md:size-12"
        >
          <EventIconImage
            src={event.icon_url || item.primaryMarkets[0]?.icon_url || '/images/pwa/default-icon-192.png'}
            alt={event.title}
            sizes="48px"
            containerClassName="size-full rounded-lg"
          />
        </AppLink>
        <div className="grid min-w-0 gap-1">
          <FeaturedBreadcrumb items={breadcrumbItems} />
          <AppLink
            intentPrefetch
            href={eventHref}
            className="
              line-clamp-2 text-lg font-semibold tracking-tight underline-offset-4
              group-hover/header:underline
              md:text-xl
            "
          >
            {event.title}
          </AppLink>
        </div>
      </div>

      {showActions && (
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" asChild aria-label={t('Open market')}>
            <AppLink intentPrefetch href={eventHref}>
              <ExternalLinkIcon className="size-5" />
            </AppLink>
          </Button>
          <div className="flex size-10 items-center justify-center">
            <EventBookmark event={event} refreshStatusOnMount={false} />
          </div>
        </div>
      )}
    </div>
  )
}

function OutcomeRows({ outcomes, linkedHref }: { outcomes: HomeFeaturedOutcomeSummary[], linkedHref: string }) {
  if (outcomes.length === 0) {
    return null
  }

  return (
    <div className="grid gap-0">
      {outcomes.map(outcome => (
        <AppLink
          key={outcome.key}
          intentPrefetch
          href={linkedHref}
          className={`
            group/outcome grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 py-2
            last:border-b-0
          `}
        >
          <span className="flex min-w-0 items-center gap-3">
            {outcome.imageUrl && (
              <span className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                <EventIconImage
                  src={outcome.imageUrl}
                  alt={outcome.label}
                  sizes="36px"
                  containerClassName="size-full rounded-md"
                />
              </span>
            )}
            <span className="truncate text-base font-medium underline-offset-2 group-hover/outcome:underline">
              {outcome.label}
            </span>
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatChancePercent(outcome.chance)}
          </span>
        </AppLink>
      ))}
    </div>
  )
}

function StandardActions({ item, linkedHref }: { item: HomeFeaturedEventCard, linkedHref: string }) {
  const primaryMarket = item.primaryMarkets[0]
  const outcomes = item.topOutcomes

  if (!primaryMarket || outcomes.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {outcomes.slice(0, 2).map((outcome, index) => {
        const isNegative = isNegativeOutcomeLabel(outcome.label) || index === 1

        return (
          <Button
            key={outcome.key}
            type="button"
            asChild
            variant={isNegative ? 'no' : 'yes'}
            className={cn(
              `
                inline-flex h-16 min-w-0 items-center justify-center rounded-lg px-4 text-center text-base font-semibold
                transition duration-150
                active:scale-[98%]
                md:h-14 md:px-4 md:text-base
              `,
            )}
          >
            <AppLink intentPrefetch href={linkedHref}>
              <span className="truncate">{outcome.label}</span>
            </AppLink>
          </Button>
        )
      })}
    </div>
  )
}

function SportsGroups({ groups, linkedHref }: { groups: HomeFeaturedSportsMarketGroup[], linkedHref: string }) {
  if (groups.length === 0) {
    return null
  }

  return (
    <div className="grid gap-3">
      {groups.map(group => (
        <div key={group.label} className="grid gap-2">
          {group.label !== 'Moneyline' && (
            <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
              <span>{group.label}</span>
            </div>
          )}
          <div
            className={cn(
              'grid gap-2',
              group.markets.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            {group.markets.slice(0, group.label === 'Moneyline' ? 3 : 2).map((market) => {
              const appearance = resolveSportsButtonAppearance(market)

              return (
                <AppLink
                  key={`${group.label}:${market.conditionId}:${market.label}`}
                  intentPrefetch
                  href={linkedHref}
                  className={cn(
                    `
                      relative inline-flex h-14 min-w-0 items-center justify-center overflow-hidden rounded-lg px-3
                      text-center text-sm font-semibold transition duration-150
                      active:scale-[98%]
                      md:h-14 md:text-base
                    `,
                    group.label === 'Moneyline' && 'md:h-14',
                    appearance.className,
                  )}
                  style={appearance.style}
                >
                  <span className="relative z-1 truncate">{market.label}</span>
                  {(appearance.backgroundClassName || appearance.backgroundStyle)
                    ? (
                        <span
                          className={cn(
                            `
                              absolute inset-0 z-0 rounded-lg opacity-20 transition-opacity
                              group-hover/team-button:opacity-40
                              dark:opacity-30
                              dark:group-hover/team-button:opacity-50
                            `,
                            appearance.backgroundClassName,
                          )}
                          style={appearance.backgroundStyle}
                        />
                      )
                    : null}
                </AppLink>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ContextAvatar({ contextItem }: { contextItem: HomeFeaturedContextItem }) {
  if (contextItem.type === 'news' && contextItem.faviconUrl) {
    return (
      <EventIconImage
        src={contextItem.faviconUrl}
        alt={contextItem.source}
        sizes="28px"
        containerClassName="size-7 shrink-0 rounded-full bg-muted"
        imageClassName="rounded-full"
      />
    )
  }

  if (contextItem.type === 'comment' && contextItem.avatarUrl) {
    return (
      <EventIconImage
        src={contextItem.avatarUrl}
        alt={contextItem.source}
        sizes="28px"
        containerClassName="size-7 shrink-0 rounded-full bg-muted"
        imageClassName="rounded-full"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="
        flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold
        text-muted-foreground
      "
    >
      {contextItem.source.trim().charAt(0).toUpperCase() || 'U'}
    </span>
  )
}

function formatContextRelativeTime(value: string | null) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) {
    return null
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000)
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ] as const
  let duration = diffSeconds

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
        Math.round(duration),
        division.unit,
      )
    }

    duration /= division.amount
  }

  return null
}

function ContextTickerItem({
  contextItem,
  index,
  linkedHref,
}: {
  contextItem: HomeFeaturedContextItem
  index: number
  linkedHref: string
}) {
  const timeLabel = formatContextRelativeTime(contextItem.publishedAt ?? contextItem.selectedAt)
  const sourceLabel = timeLabel ? `${contextItem.source} · ${timeLabel}` : contextItem.source

  return (
    <AppLink
      key={`${contextItem.id}:${index}`}
      intentPrefetch
      href={linkedHref}
      className="flex h-14 min-w-0 items-center gap-2"
    >
      <ContextAvatar contextItem={contextItem} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-xs font-medium text-foreground">
          {sourceLabel}
        </span>
        <span className="line-clamp-2 text-xs/snug text-muted-foreground">
          {contextItem.title}
        </span>
      </span>
    </AppLink>
  )
}

function ContextTicker({ item, linkedHref }: { item: HomeFeaturedEventCard, linkedHref: string }) {
  if (item.contextItems.length === 0) {
    return null
  }

  const tickerItems = item.contextItems.length === 1
    ? item.contextItems
    : [...item.contextItems, ...item.contextItems]
  const tickerDistance = item.contextItems.length * 64
  const tickerStyle = item.contextItems.length > 1
    ? ({
        '--home-featured-context-distance': `${tickerDistance}px`,
        'animationDuration': `${Math.max(14, item.contextItems.length * 3.8)}s`,
      } as CSSProperties)
    : undefined

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden border-t border-border/50 pt-3">
      <div
        className={cn(
          item.contextItems.length > 1
          && 'grid animate-[home-featured-context-ticker_16s_linear_infinite] gap-2 motion-reduce:animate-none',
        )}
        style={tickerStyle}
      >
        {tickerItems.map((contextItem, index) => (
          <ContextTickerItem
            key={`${contextItem.id}:${index}`}
            contextItem={contextItem}
            index={index}
            linkedHref={linkedHref}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-b from-transparent to-card" />
    </div>
  )
}

function SportsScoreboard({ item }: { item: HomeFeaturedEventCard }) {
  const teams = item.event.sports_teams ?? []
  const logos = item.event.sports_team_logo_urls ?? []
  const score = item.event.sports_score?.trim()
  if (item.kind !== 'sports' || teams.length < 2) {
    return null
  }

  const [homeTeam, awayTeam] = teams
  const [homeLogo, awayLogo] = logos

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-secondary/60 p-3">
      <div className="min-w-0 text-center">
        {homeLogo && (
          <EventIconImage
            src={homeLogo}
            alt={homeTeam?.name ?? ''}
            sizes="36px"
            containerClassName="mx-auto mb-1 size-9 rounded-md"
          />
        )}
        <p className="truncate text-sm font-medium">{homeTeam?.name}</p>
      </div>
      <div className="text-center">
        <p className="text-3xl font-semibold tabular-nums">{score || '0 - 0'}</p>
        {(item.event.sports_period || item.event.sports_elapsed) && (
          <p className="text-sm font-medium text-red-500">
            {[item.event.sports_period, item.event.sports_elapsed].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="min-w-0 text-center">
        {awayLogo && (
          <EventIconImage
            src={awayLogo}
            alt={awayTeam?.name ?? ''}
            sizes="36px"
            containerClassName="mx-auto mb-1 size-9 rounded-md"
          />
        )}
        <p className="truncate text-sm font-medium">{awayTeam?.name}</p>
      </div>
    </div>
  )
}

function FeaturedFooter({ item }: { item: HomeFeaturedEventCard }) {
  const site = useSiteIdentity()

  return (
    <div
      className={`
        absolute inset-x-4 bottom-3 z-20 flex h-10 shrink-0 items-center justify-between gap-3 bg-card text-xs
        leading-none font-normal text-muted-foreground
        md:inset-x-5 md:bottom-4 md:text-sm
      `}
    >
      <span className="shrink-0">{formatVolumeLabel(item.event.volume)}</span>
      <span className="flex min-w-0 items-center justify-end gap-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap',
          item.temporalStatus === 'live' && 'text-red-500',
        )}
        >
          {item.temporalStatus === 'live' && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
          )}
          {item.temporalLabel}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="flex min-w-0 items-center gap-1.5 leading-none">
          <SiteLogoIcon
            logoSvg={site.logoSvg}
            logoImageUrl={site.logoImageUrl}
            alt={`${site.name} logo`}
            className={cn(`
              pointer-events-none size-4 shrink-0 text-current select-none
              [&_svg]:size-4
              [&_svg_*]:fill-current [&_svg_*]:stroke-current
            `)}
            imageClassName="pointer-events-none size-4 object-contain select-none"
            size={16}
          />
          <span className="truncate select-none">{site.name}</span>
        </span>
      </span>
    </div>
  )
}

function FeaturedRightRail({
  hotTopics,
  sideCard,
}: {
  hotTopics: HomeFeaturedHotTopic[]
  sideCard: HomeFeaturedSideCardSettings
}) {
  const hasCta = Boolean(sideCard.ctaLabel.trim() && sideCard.ctaHref.trim())
  const sideCardHref = sideCard.ctaHref.trim()
  const sideCardClassName = `
    group/side-card relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/70
    bg-card p-5 text-card-foreground shadow-md shadow-black/4 transition-all duration-200
    hover:-translate-y-0.5 hover:border-border hover:shadow-black/8
    focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none
  `
  const sideCardContent = (
    <>
      <span className="
        pointer-events-none absolute bottom-0 left-[30%] h-px w-[40%] bg-linear-to-r from-transparent via-primary/60
        to-transparent
      "
      />
      <DynamicIcon
        name={sideCard.icon as IconName}
        aria-hidden
        className="
          pointer-events-none absolute -top-6 -right-7 size-36 rotate-6 text-primary/8 transition-transform duration-300
          group-hover/side-card:scale-105
          motion-safe:animate-pulse
        "
      />

      <div className="relative z-1 flex min-h-0 flex-1 flex-col pt-7 pb-4">
        <span
          className="
            mb-3 h-1 w-10 rounded-full bg-primary/70
            shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_32%,transparent)]
          "
        />
        <span className="line-clamp-2 max-w-[16rem] text-xl/tight font-semibold tracking-tight">
          {sideCard.title}
        </span>
        <span className={cn(
          'mt-5 text-sm/relaxed text-muted-foreground',
          hasCta ? 'line-clamp-4' : 'line-clamp-5',
        )}
        >
          {sideCard.text}
        </span>

        {hasCta && (
          <span
            className="
              mt-auto ml-auto inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border/70
              bg-background/70 px-3 text-sm font-medium text-foreground shadow-sm shadow-black/4 transition-colors
              group-hover/side-card:border-primary/35 group-hover/side-card:text-primary
            "
          >
            <span className="truncate">{sideCard.ctaLabel}</span>
            <ChevronRightIcon className="size-4 shrink-0" />
          </span>
        )}
      </div>
    </>
  )

  return (
    <aside className="hidden h-[clamp(430px,38vw,480px)] min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid">
      {hasCta
        ? isExternalHref(sideCardHref)
          ? (
              <a
                href={sideCardHref}
                target="_blank"
                rel="noreferrer"
                className={sideCardClassName}
              >
                {sideCardContent}
              </a>
            )
          : (
              <AppLink
                intentPrefetch
                href={sideCardHref}
                className={sideCardClassName}
              >
                {sideCardContent}
              </AppLink>
            )
        : (
            <div className={sideCardClassName}>
              {sideCardContent}
            </div>
          )}

      <div className="min-h-0 overflow-hidden p-1">
        <div className="mb-3 flex items-center gap-2">
          <FlameIcon className="size-4 text-no" />
          <span className="text-lg font-semibold">Hot topics</span>
        </div>
        <div className="grid gap-3">
          {hotTopics.map((topic, index) => (
            <AppLink
              key={topic.slug}
              intentPrefetch
              href={topic.href}
              className="group/topic grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md py-0.5"
            >
              <span className="w-4 text-sm font-medium text-muted-foreground">{index + 1}</span>
              <span className="truncate text-base font-medium underline-offset-2 group-hover/topic:underline">
                {topic.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {`${formatDollarValueLabel(topic.volume24h, { maximumFractionDigits: 0 })} 24h`}
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </AppLink>
          ))}
        </div>
      </div>
    </aside>
  )
}

function FeaturedRightRailAction() {
  return (
    <div className="hidden lg:block">
      <Button
        type="button"
        variant="outline"
        asChild
        className="
          h-10 w-full rounded-full bg-transparent text-muted-foreground shadow-none transition-colors
          hover:bg-secondary/80 hover:text-foreground
          dark:bg-transparent
          dark:hover:bg-secondary/80
        "
      >
        <AppLink intentPrefetch href="/predictions/trending">
          Expand all
        </AppLink>
      </Button>
    </div>
  )
}

function FeaturedSlide({
  item,
  isActive,
  isNext,
  isChartEnabled,
}: {
  item: HomeFeaturedEventCard
  isActive: boolean
  isNext: boolean
  isChartEnabled: boolean
}) {
  const isMobile = useIsMobile()
  const linkedHref = resolveEventPagePath(item.event)
  const shouldRenderChart = isChartEnabled && (isActive || isNext)
  const [chartContainerRef, chartContainerWidth] = useElementWidth<HTMLDivElement>(shouldRenderChart)
  const isSingleMarket = item.event.total_markets_count === 1 || item.event.markets.length === 1
  const shouldRenderLiveSeriesChart = Boolean(
    item.liveChartConfig && shouldUseLiveSeriesChart(item.event, item.liveChartConfig),
  )
  const sportsGraphCard = useMemo(
    () => (item.kind === 'sports' ? buildSportsGamesCards([item.event])[0] ?? null : null),
    [item.event, item.kind],
  )
  const sportsGraphSelection = useMemo(
    () => (sportsGraphCard ? resolveSportsGraphSelection(sportsGraphCard) : null),
    [sportsGraphCard],
  )
  const liveChartWidth = typeof chartContainerWidth === 'number' && Number.isFinite(chartContainerWidth)
    ? Math.max(1, chartContainerWidth - HOME_FEATURED_LIVE_CHART_WIDTH_OFFSET)
    : undefined
  const hasContextItems = item.contextItems.length > 0
  const featuredDetailsClassName = cn(
    'flex min-h-0 min-w-0 flex-col gap-3',
    !hasContextItems && 'justify-center',
  )

  const chartNode = (
    <div
      ref={shouldRenderChart ? chartContainerRef : undefined}
      className={cn(
        'relative min-h-60 min-w-0 overflow-hidden md:min-h-[260px] lg:min-h-[280px]',
        shouldRenderLiveSeriesChart && 'lg:-mt-1',
      )}
    >
      {shouldRenderChart && (
        <EventMarketChannelProvider markets={item.event.markets}>
          {shouldRenderLiveSeriesChart && item.liveChartConfig
            ? (
                <HomeEventLiveSeriesChart
                  event={item.event}
                  isMobile={isMobile}
                  config={item.liveChartConfig}
                  chartWidth={liveChartWidth}
                  chartHeightOffset={HOME_FEATURED_CHART_HEIGHT_OFFSET}
                  showSeriesControls={false}
                />
              )
            : item.kind === 'sports' && sportsGraphCard && sportsGraphSelection
              ? (
                  <HomeSportsGameGraph
                    card={sportsGraphCard}
                    selectedMarketType={sportsGraphSelection.selectedMarketType}
                    selectedConditionId={sportsGraphSelection.selectedConditionId}
                    defaultTimeRange="ALL"
                    chartHeightOffset={HOME_FEATURED_CHART_HEIGHT_OFFSET}
                    variant="sportsEventHero"
                    showControls={false}
                  />
                )
              : (
                  <EventChart
                    event={item.event}
                    isMobile={isMobile}
                    showControls={false}
                    showSeriesNavigation={false}
                    showWatermark={false}
                    legendVariant="card"
                    chartWidth={chartContainerWidth}
                    chartHeight={HOME_FEATURED_CHART_HEIGHT}
                    isSingleMarketOverride={isSingleMarket}
                    forceVisible
                  />
                )}
        </EventMarketChannelProvider>
      )}
    </div>
  )

  if (shouldRenderLiveSeriesChart) {
    return (
      <article className="
        relative flex h-full min-w-full flex-col gap-4 overflow-hidden p-4 pb-[64px]
        md:p-5 md:pb-[68px]
      "
      >
        <div className="
          grid min-h-0 flex-1 grid-cols-1 gap-4
          md:grid-cols-[minmax(240px,0.68fr)_minmax(320px,1fr)] md:gap-5
          lg:grid-cols-[minmax(280px,0.68fr)_minmax(420px,1fr)] lg:gap-6
        "
        >
          <div className={featuredDetailsClassName}>
            <FeaturedHeader item={item} showActions={false} />

            {item.kind === 'sports'
              ? <SportsGroups groups={item.sportsMarketGroups} linkedHref={linkedHref} />
              : item.kind === 'standard'
                ? <StandardActions item={item} linkedHref={linkedHref} />
                : <OutcomeRows outcomes={item.topOutcomes} linkedHref={linkedHref} />}

            <ContextTicker item={item} linkedHref={linkedHref} />
          </div>

          {chartNode}
        </div>
        <FeaturedFooter item={item} />
      </article>
    )
  }

  return (
    <article className="
      relative flex h-full min-w-full flex-col gap-4 overflow-hidden p-4 pb-[64px]
      md:p-5 md:pb-[68px]
    "
    >
      <FeaturedHeader item={item} />
      <div className="
        grid min-h-0 flex-1 grid-cols-1 gap-4
        md:grid-cols-[minmax(260px,0.8fr)_minmax(320px,1fr)] md:gap-5
        lg:grid-cols-[minmax(320px,0.8fr)_minmax(420px,1fr)] lg:gap-6
      "
      >
        <div className={featuredDetailsClassName}>
          <SportsScoreboard item={item} />

          {item.kind === 'sports'
            ? <SportsGroups groups={item.sportsMarketGroups} linkedHref={linkedHref} />
            : item.kind === 'standard'
              ? <StandardActions item={item} linkedHref={linkedHref} />
              : <OutcomeRows outcomes={item.topOutcomes} linkedHref={linkedHref} />}

          <ContextTicker item={item} linkedHref={linkedHref} />
        </div>

        {chartNode}
      </div>
      <FeaturedFooter item={item} />
    </article>
  )
}

export default function HomeFeaturedEventsCarousel({ hotTopics, items, sideCard }: HomeFeaturedEventsCarouselProps) {
  const t = useExtracted()
  const sectionRef = useRef<HTMLElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isChartNearViewport, setIsChartNearViewport] = useState(false)
  const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false)
  const hasMultipleItems = items.length > 1
  const activeItem = items[activeIndex]
  const nextIndex = items.length === 0 ? 0 : (activeIndex + 1) % items.length

  useEffect(function observeFeaturedCarousel() {
    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        return
      }

      setIsChartNearViewport(true)
      observer.disconnect()
    }, { rootMargin: '480px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!activeItem) {
    return null
  }

  function goToIndex(nextIndex: number) {
    if (items.length === 0) {
      return
    }

    setActiveIndex((nextIndex + items.length) % items.length)
  }

  return (
    <section ref={sectionRef} className="hidden gap-3 md:grid">
      <div className="grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)]">
        <div
          className="h-[clamp(430px,38vw,480px)] overflow-hidden rounded-xl border bg-card shadow-md shadow-black/4"
          onMouseEnter={() => setIsAutoAdvancePaused(true)}
          onMouseLeave={() => setIsAutoAdvancePaused(false)}
          onFocusCapture={() => setIsAutoAdvancePaused(true)}
          onBlurCapture={() => setIsAutoAdvancePaused(false)}
        >
          <div
            className={`
              flex h-full transition-transform duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform
              motion-reduce:transition-none
            `}
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {items.map((item, index) => (
              <FeaturedSlide
                key={item.featuredId}
                item={item}
                isActive={index === activeIndex}
                isNext={index === nextIndex}
                isChartEnabled={isChartNearViewport}
              />
            ))}
          </div>
        </div>

        <FeaturedRightRail hotTopics={hotTopics} sideCard={sideCard} />

        {hasMultipleItems
          ? (
              <div className="flex items-center justify-between gap-4 px-4 md:px-5 lg:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  {items.map((item, index) => (
                    <button
                      key={`dot-${item.featuredId}`}
                      type="button"
                      aria-label={t('Show featured market')}
                      aria-current={index === activeIndex ? 'true' : undefined}
                      onClick={() => goToIndex(index)}
                      className={cn(
                        'relative h-2 rounded-full transition-all',
                        index === activeIndex
                          ? 'w-12 overflow-hidden bg-muted-foreground/30'
                          : 'w-2 bg-muted-foreground/35 hover:bg-muted-foreground/60',
                      )}
                    >
                      {index === activeIndex && (
                        <span
                          key={`progress-${item.featuredId}-${activeIndex}`}
                          className="
                            absolute inset-y-0 left-0 w-full origin-left
                            animate-[home-featured-pagination-progress_7000ms_linear_forwards] rounded-full
                            bg-foreground/80
                            motion-reduce:scale-x-100 motion-reduce:animate-none
                          "
                          style={{ animationPlayState: isAutoAdvancePaused ? 'paused' : 'running' }}
                          onAnimationEnd={() => {
                            if (!isAutoAdvancePaused) {
                              goToIndex(activeIndex + 1)
                            }
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div
                  className="flex min-w-0 items-center gap-2"
                  onMouseEnter={() => setIsAutoAdvancePaused(true)}
                  onMouseLeave={() => setIsAutoAdvancePaused(false)}
                  onFocusCapture={() => setIsAutoAdvancePaused(true)}
                  onBlurCapture={() => setIsAutoAdvancePaused(false)}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-full px-3 text-muted-foreground hover:text-muted-foreground md:px-4"
                    onClick={() => goToIndex(activeIndex - 1)}
                  >
                    <ChevronLeftIcon className="size-4" />
                    <span className="hidden max-w-44 truncate text-xs md:inline">{activeItem.previousTitle}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-full px-3 text-muted-foreground hover:text-muted-foreground md:px-4"
                    onClick={() => goToIndex(activeIndex + 1)}
                  >
                    <span className="hidden max-w-44 truncate text-xs md:inline">{activeItem.nextTitle}</span>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            )
          : <div />}

        <FeaturedRightRailAction />
      </div>
    </section>
  )
}
