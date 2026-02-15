'use client'

import type { Market, Outcome } from '@/types'
import { InfoIcon, RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import ConnectionStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/ConnectionStatusIndicator'
import { useMarketChannelStatus } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventOrderBook, {
  useOrderBookSummaries,
} from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'

interface EventSingleMarketOrderBookProps {
  market: Market
  eventSlug: string
  showCompactVolume?: boolean
}

type OutcomeToggleIndex = typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO

export default function EventSingleMarketOrderBook({
  market,
  eventSlug,
  showCompactVolume = false,
}: EventSingleMarketOrderBookProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const marketChannelStatus = useMarketChannelStatus()
  const [isExpanded, setIsExpanded] = useState(true)
  const orderMarket = useOrder(state => state.market)
  const orderOutcome = useOrder(state => state.outcome)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)

  const initialOutcomeIndex = useMemo<OutcomeToggleIndex>(() => {
    if (orderMarket?.condition_id === market.condition_id && orderOutcome) {
      return orderOutcome.outcome_index === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES
    }
    return OUTCOME_INDEX.YES
  }, [orderMarket?.condition_id, orderOutcome, market.condition_id])

  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<OutcomeToggleIndex>(initialOutcomeIndex)

  useEffect(() => {
    if (orderMarket?.condition_id === market.condition_id && orderOutcome) {
      setSelectedOutcomeIndex(orderOutcome.outcome_index === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES)
    }
  }, [orderMarket?.condition_id, orderOutcome, market.condition_id])

  const tokenIds = useMemo(
    () => market.outcomes
      .map(outcome => outcome.token_id)
      .filter((id): id is string => Boolean(id)),
    [market.outcomes],
  )

  const {
    data: orderBookSummaries,
    isLoading: isOrderBookLoading,
    refetch: refetchOrderBook,
    isRefetching: isOrderBookRefetching,
  } = useOrderBookSummaries(tokenIds, { enabled: isExpanded })

  const selectedOutcome: Outcome | undefined = market.outcomes[selectedOutcomeIndex] ?? market.outcomes[0]
  const yesOutcomeText = market.outcomes[OUTCOME_INDEX.YES]?.outcome_text
  const noOutcomeText = market.outcomes[OUTCOME_INDEX.NO]?.outcome_text
  const yesOutcomeLabel = (yesOutcomeText ? normalizeOutcomeLabel(yesOutcomeText) : '') || yesOutcomeText || t('Yes')
  const noOutcomeLabel = (noOutcomeText ? normalizeOutcomeLabel(noOutcomeText) : '') || noOutcomeText || t('No')
  const isLoadingSummaries = isExpanded && isOrderBookLoading && !orderBookSummaries
  const compactVolumeLabel = useMemo(() => {
    if (!showCompactVolume) {
      return null
    }

    const resolvedVolume = Number.isFinite(market.volume) ? market.volume : 0
    if (resolvedVolume <= 0) {
      return null
    }

    return `$${resolvedVolume.toLocaleString('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    })} Vol.`
  }, [market.volume, showCompactVolume])

  function handleOutcomeSelection(outcomeIndex: OutcomeToggleIndex) {
    setSelectedOutcomeIndex(outcomeIndex)
    const outcome = market.outcomes[outcomeIndex]
    if (!outcome) {
      return
    }
    setOrderMarket(market)
    setOrderOutcome(outcome)
  }

  if (market.outcomes.length < 2) {
    return <></>
  }

  return (
    <section className="overflow-hidden rounded-xl border transition-all duration-500 ease-in-out">
      <button
        type="button"
        onClick={() => setIsExpanded(current => !current)}
        className={cn(
          `
            flex h-18 w-full items-center justify-between p-4 text-left transition-colors
            hover:bg-muted/50
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            focus-visible:ring-offset-background focus-visible:outline-none
          `,
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-medium">{t('Order Book')}</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Order book information"
                onClick={(event) => {
                  event.stopPropagation()
                }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
              >
                <InfoIcon className="size-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-68 text-left">
              The order book shows all open buy and sell orders for this market. Use it to place limit orders at your preferred price.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="pointer-events-none flex items-center gap-2">
          {compactVolumeLabel && (
            <span className="text-sm font-medium text-muted-foreground">{compactVolumeLabel}</span>
          )}
          <span aria-hidden="true" className="flex size-8 items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn('size-6 text-muted-foreground transition-transform', { 'rotate-180': isExpanded })}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </button>

      <div
        className={cn(
          'grid overflow-hidden transition-all duration-500 ease-in-out',
          isExpanded
            ? 'pointer-events-auto grid-rows-[1fr] opacity-100'
            : 'pointer-events-none grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!isExpanded}
      >
        <div
          className={cn(
            'overflow-hidden',
            { 'border-t border-border/30': isExpanded },
          )}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b p-3 pb-0 text-sm font-semibold"
          >
            <div className="flex flex-wrap gap-4">
              <OutcomeToggle
                label={t('Trade {outcome}', { outcome: yesOutcomeLabel })}
                selected={selectedOutcomeIndex === OUTCOME_INDEX.YES}
                onClick={() => handleOutcomeSelection(OUTCOME_INDEX.YES)}
              />
              <OutcomeToggle
                label={t('Trade {outcome}', { outcome: noOutcomeLabel })}
                selected={selectedOutcomeIndex === OUTCOME_INDEX.NO}
                onClick={() => handleOutcomeSelection(OUTCOME_INDEX.NO)}
              />
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatusIndicator
                className="flex items-center justify-end py-2"
                status={marketChannelStatus}
              />
              <button
                type="button"
                onClick={() => { void refetchOrderBook() }}
                className={cn(
                  `inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors`,
                  'hover:bg-muted/70 hover:text-foreground',
                  'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                )}
                aria-label={t('Refresh order book')}
                title={t('Refresh order book')}
                disabled={isOrderBookLoading || isOrderBookRefetching}
              >
                <RefreshCwIcon
                  className={cn(
                    'size-3',
                    { 'animate-spin': isOrderBookLoading || isOrderBookRefetching },
                  )}
                />
              </button>
            </div>
          </div>
          <EventOrderBook
            market={market}
            outcome={selectedOutcome}
            summaries={orderBookSummaries}
            isLoadingSummaries={isLoadingSummaries}
            eventSlug={eventSlug}
          />
        </div>
      </div>
    </section>
  )
}

interface OutcomeToggleProps {
  label: string
  selected: boolean
  onClick: () => void
}

function OutcomeToggle({ label, selected, onClick }: OutcomeToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `-mb-0.5 border-b-3 border-transparent pt-1 pb-2 text-sm font-semibold transition-colors`,
        selected
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
