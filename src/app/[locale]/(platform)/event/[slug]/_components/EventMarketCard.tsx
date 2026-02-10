'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { memo, useMemo } from 'react'
import EventMarketChance from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChance'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel, formatSharesLabel } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface MarketPositionTag {
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  label: string
  shares: number
  avgPrice: number | null
}

interface EventMarketCardProps {
  row: EventMarketRow
  showMarketIcon: boolean
  isExpanded: boolean
  isActiveMarket: boolean
  showInReviewTag?: boolean
  activeOutcomeIndex: number | null
  onToggle: () => void
  onBuy: (market: EventMarketRow['market'], outcomeIndex: number, source: 'mobile' | 'desktop') => void
  chanceHighlightKey: string
  positionTags?: MarketPositionTag[]
  openOrdersCount?: number
  onCashOut?: (market: EventMarketRow['market'], tag: MarketPositionTag) => void
}

function EventMarketCardComponent({
  row,
  showMarketIcon,
  isExpanded,
  isActiveMarket,
  showInReviewTag = false,
  activeOutcomeIndex,
  onToggle,
  onBuy,
  chanceHighlightKey,
  positionTags = [],
  openOrdersCount = 0,
  onCashOut,
}: EventMarketCardProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { market, yesOutcome, noOutcome, yesPriceValue, noPriceValue, chanceMeta } = row
  const yesOutcomeText = normalizeOutcomeLabel(yesOutcome?.outcome_text) ?? t('Yes')
  const noOutcomeText = normalizeOutcomeLabel(noOutcome?.outcome_text) ?? t('No')
  const resolvedPositionTags = positionTags.filter(tag => tag.shares > 0)
  const hasOpenOrders = openOrdersCount > 0
  const shouldShowTags = resolvedPositionTags.length > 0 || hasOpenOrders
  const shouldShowIcon = showMarketIcon && Boolean(market.icon_url)
  const volumeRequestPayload = useMemo(() => {
    const tokenIds = [yesOutcome?.token_id, noOutcome?.token_id].filter(Boolean) as string[]
    if (!market.condition_id || tokenIds.length < 2) {
      return { conditions: [], signature: '' }
    }

    const signature = `${market.condition_id}:${tokenIds.join(':')}`
    return {
      conditions: [{ condition_id: market.condition_id, token_ids: tokenIds.slice(0, 2) as [string, string] }],
      signature,
    }
  }, [market.condition_id, noOutcome?.token_id, yesOutcome?.token_id])

  const { data: volumeFromApi } = useQuery({
    queryKey: ['trade-volumes', market.condition_id, volumeRequestPayload.signature],
    enabled: volumeRequestPayload.conditions.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(`${process.env.CLOB_URL}/data/volumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          include_24h: false,
          conditions: volumeRequestPayload.conditions,
        }),
      })

      const payload = await response.json() as Array<{
        condition_id: string
        status: number
        volume?: string
      }>

      return payload
        .filter(entry => entry?.status === 200)
        .reduce((total, entry) => {
          const numeric = Number(entry.volume ?? 0)
          return Number.isFinite(numeric) ? total + numeric : total
        }, 0)
    },
  })

  const resolvedVolume = useMemo(() => {
    if (typeof volumeFromApi === 'number' && Number.isFinite(volumeFromApi)) {
      return volumeFromApi
    }
    return market.volume
  }, [market.volume, volumeFromApi])

  return (
    <div
      className={cn(
        `
          group relative z-0 flex w-full cursor-pointer flex-col items-start py-3 pr-2 pl-4 transition-all duration-200
          ease-in-out
          before:pointer-events-none before:absolute before:inset-y-0 before:-right-3 before:-left-3 before:-z-10
          before:rounded-lg before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200
          before:content-['']
          hover:before:opacity-100
          lg:flex-row lg:items-center lg:rounded-lg lg:px-0
          dark:before:bg-white/5
        `,
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="relative w-full">
        <div className="w-full lg:hidden">
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                {shouldShowIcon && (
                  <Image
                    src={market.icon_url}
                    alt={market.title}
                    width={42}
                    height={42}
                    className="shrink-0 rounded-md"
                  />
                )}
                <div>
                  <div className="text-sm font-bold underline-offset-2 group-hover:underline">
                    {market.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    $
                    {resolvedVolume?.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || '0.00'}
                    {' '}
                    Vol.
                  </div>
                </div>
              </div>
              <EventMarketChance
                market={market}
                chanceMeta={chanceMeta}
                layout="mobile"
                highlightKey={chanceHighlightKey}
                showInReviewTag={showInReviewTag}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="outcomeLg"
              variant="yes"
              className={cn({
                'bg-yes text-white': isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.YES,
              })}
              onClick={(event) => {
                event.stopPropagation()
                onBuy(market, OUTCOME_INDEX.YES, 'mobile')
              }}
            >
              <span className="truncate opacity-70">
                {yesOutcomeText}
              </span>
              <span className="shrink-0 text-base font-bold">
                {formatCentsLabel(yesPriceValue)}
              </span>
            </Button>
            <Button
              size="outcomeLg"
              variant="no"
              className={cn({
                'bg-no text-white': isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.NO,
              })}
              onClick={(event) => {
                event.stopPropagation()
                onBuy(market, OUTCOME_INDEX.NO, 'mobile')
              }}
            >
              <span className="truncate opacity-70">
                {noOutcomeText}
              </span>
              <span className="shrink-0 text-base font-bold">
                {formatCentsLabel(noPriceValue)}
              </span>
            </Button>
          </div>
          {shouldShowTags && (
            <div className="mt-2">
              <PositionTags
                tags={resolvedPositionTags}
                openOrdersCount={openOrdersCount}
                onCashOut={tag => onCashOut?.(market, tag)}
              />
            </div>
          )}
        </div>

        <div className="hidden w-full flex-col lg:flex">
          <div className="flex w-full items-center">
            <div className="flex w-2/5 flex-col gap-2">
              <div className="flex items-start gap-3">
                {shouldShowIcon && (
                  <Image
                    src={market.icon_url}
                    alt={market.title}
                    width={42}
                    height={42}
                    className="shrink-0 rounded-md"
                  />
                )}
                <div>
                  <div className="font-semibold underline-offset-2 group-hover:underline">
                    {market.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    $
                    {resolvedVolume?.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || '0.00'}
                    {' '}
                    Vol.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-1/5 justify-center">
              <EventMarketChance
                market={market}
                chanceMeta={chanceMeta}
                layout="desktop"
                highlightKey={chanceHighlightKey}
                showInReviewTag={showInReviewTag}
              />
            </div>

            <div className="ms-auto flex items-center gap-2">
              <Button
                size="outcomeLg"
                variant="yes"
                className={cn({
                  'bg-yes text-white': isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.YES,
                }, 'w-34')}
                onClick={(event) => {
                  event.stopPropagation()
                  onBuy(market, OUTCOME_INDEX.YES, 'desktop')
                }}
              >
                <span className="truncate opacity-70">
                  {yesOutcomeText}
                </span>
                <span className="shrink-0 text-base font-bold">
                  {formatCentsLabel(yesPriceValue)}
                </span>
              </Button>

              <Button
                size="outcomeLg"
                variant="no"
                className={cn({
                  'bg-no text-white': isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.NO,
                }, 'w-34')}
                onClick={(event) => {
                  event.stopPropagation()
                  onBuy(market, OUTCOME_INDEX.NO, 'desktop')
                }}
              >
                <span className="truncate opacity-70">
                  {noOutcomeText}
                </span>
                <span className="shrink-0 text-base font-bold">
                  {formatCentsLabel(noPriceValue)}
                </span>
              </Button>
            </div>
          </div>
          {shouldShowTags && (
            <div className="mt-2">
              <PositionTags
                tags={resolvedPositionTags}
                openOrdersCount={openOrdersCount}
                onCashOut={tag => onCashOut?.(market, tag)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EventMarketCard = memo(EventMarketCardComponent)

export default EventMarketCard

function PositionTags({
  tags,
  openOrdersCount = 0,
  onCashOut,
}: {
  tags: MarketPositionTag[]
  openOrdersCount?: number
  onCashOut?: (tag: MarketPositionTag) => void
}) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const hasOpenOrders = openOrdersCount > 0
  const openOrdersLabel = `${openOrdersCount} open order${openOrdersCount === 1 ? '' : 's'}`
  return (
    <div className="flex flex-wrap gap-1">
      {hasOpenOrders && (
        <div className={`
          inline-flex items-center rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs/tight font-semibold text-amber-700
          dark:text-amber-200
        `}
        >
          {openOrdersLabel}
        </div>
      )}
      {tags.map((tag) => {
        const isYes = tag.outcomeIndex === OUTCOME_INDEX.YES
        const label = normalizeOutcomeLabel(tag.label) || (isYes ? t('Yes') : t('No'))
        const sharesLabel = formatSharesLabel(tag.shares)
        const avgPriceLabel = formatCentsLabel(tag.avgPrice, { fallback: '—' })

        return (
          <div
            key={`${tag.outcomeIndex}-${label}`}
            className={cn(
              `group inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs/tight font-semibold transition-all`,
              isYes ? 'bg-yes/15 text-yes-foreground' : 'bg-no/15 text-no-foreground',
            )}
          >
            <span className="whitespace-nowrap">
              {label}
              {' '}
              {sharesLabel}
              {' '}
              •
              {' '}
              {avgPriceLabel}
            </span>
            <button
              type="button"
              className={cn(
                'ml-1 inline-flex w-0 items-center justify-center overflow-hidden opacity-0',
                'transition-all duration-200 group-hover:w-3 group-hover:opacity-100',
                'pointer-events-none group-hover:pointer-events-auto',
              )}
              aria-label={`Sell ${label} shares`}
              onClick={(event) => {
                event.stopPropagation()
                onCashOut?.(tag)
              }}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
