import type { ReactNode } from 'react'
import type { OddsFormat } from '@/lib/odds-format'
import type { Event, Market, Outcome } from '@/types'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useExtracted } from 'next-intl'
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/app/[locale]/(platform)/_lib/mobile-bottom-nav'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel } from '@/lib/formatters'
import { formatOddsFromPrice } from '@/lib/odds-format'
import { useIsSingleMarket, useOrder, useOutcomeTopOfBookPrice } from '@/stores/useOrder'

interface EventMobileOrderPanelProps {
  event: Event
  initialMarket?: Market | null
  initialOutcome?: Outcome | null
  showDefaultTrigger?: boolean
  mobileMarketInfo?: ReactNode
  primaryOutcomeIndex?: number | null
  oddsFormat?: OddsFormat
  outcomeButtonStyleVariant?: 'default' | 'sports3d'
  optimisticallyClaimedConditionIds?: Record<string, true>
}

export default function EventOrderPanelMobile({
  event,
  initialMarket = null,
  initialOutcome = null,
  showDefaultTrigger = true,
  mobileMarketInfo,
  primaryOutcomeIndex = null,
  oddsFormat = 'price',
  outcomeButtonStyleVariant = 'default',
  optimisticallyClaimedConditionIds,
}: EventMobileOrderPanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const state = useOrder()
  const hasMatchingStoreEvent = state.event?.id === event.id
  const hasMatchingStoreMarket = Boolean(
    state.market
    && event.markets.some(market => market.condition_id === state.market?.condition_id),
  )
  const activeEvent: Event = hasMatchingStoreEvent && state.event ? state.event : event
  const activeMarket = hasMatchingStoreMarket ? state.market : initialMarket
  const fallbackOutcome = initialOutcome ?? activeMarket?.outcomes[0] ?? null
  const hasMatchingStoreOutcome = Boolean(
    state.outcome
    && activeMarket
    && state.outcome.condition_id === activeMarket.condition_id,
  )
  const activeOutcome = hasMatchingStoreOutcome ? state.outcome : fallbackOutcome
  const isSingleMarket = useIsSingleMarket() || activeEvent.total_markets_count === 1
  const liveYesPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.YES, ORDER_SIDE.BUY)
  const liveNoPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.NO, ORDER_SIDE.BUY)
  const activeLiveYesPrice = hasMatchingStoreMarket ? liveYesPrice : null
  const activeLiveNoPrice = hasMatchingStoreMarket ? liveNoPrice : null
  const yesOutcome = activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
    ?? activeMarket?.outcomes[OUTCOME_INDEX.YES]
  const noOutcome = activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)
    ?? activeMarket?.outcomes[OUTCOME_INDEX.NO]
  const marketPrice = typeof activeMarket?.price === 'number' && Number.isFinite(activeMarket.price)
    ? activeMarket.price
    : typeof activeMarket?.probability === 'number' && Number.isFinite(activeMarket.probability)
      ? activeMarket.probability / 100
      : null
  const yesPrice = activeLiveYesPrice ?? (
    typeof yesOutcome?.buy_price === 'number'
      ? yesOutcome.buy_price
      : marketPrice
  )
  const noPrice = activeLiveNoPrice ?? (
    typeof noOutcome?.buy_price === 'number'
      ? noOutcome.buy_price
      : typeof marketPrice === 'number'
        ? Math.max(0, Math.min(1, 1 - marketPrice))
        : null
  )
  const buyYesOutcome = yesOutcome ?? activeMarket?.outcomes[0] ?? null
  const buyNoOutcome = noOutcome ?? activeMarket?.outcomes[1] ?? null
  const buyYesOutcomeLabel = buyYesOutcome?.outcome_text
    ? (normalizeOutcomeLabel(buyYesOutcome.outcome_text) ?? buyYesOutcome.outcome_text)
    : t('Yes')
  const buyNoOutcomeLabel = buyNoOutcome?.outcome_text
    ? (normalizeOutcomeLabel(buyNoOutcome.outcome_text) ?? buyNoOutcome.outcome_text)
    : t('No')
  const shouldShowDefaultTrigger = showDefaultTrigger && isSingleMarket
  const yesPriceLabel = oddsFormat === 'price'
    ? formatCentsLabel(yesPrice)
    : formatOddsFromPrice(yesPrice, oddsFormat)
  const noPriceLabel = oddsFormat === 'price'
    ? formatCentsLabel(noPrice)
    : formatOddsFromPrice(noPrice, oddsFormat)

  return (
    <Drawer
      open={state.isMobileOrderPanelOpen}
      onClose={() => state.setIsMobileOrderPanelOpen(false)}
      repositionInputs={false}
    >
      {shouldShowDefaultTrigger && (
        <DrawerTrigger asChild>
          <div
            className="fixed inset-x-0 z-30 border-t bg-background p-4 lg:hidden"
            style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
          >
            <div className="flex gap-2">
              <Button
                variant="yes"
                size="outcomeLg"
                onClick={() => {
                  if (!activeMarket || !buyYesOutcome) {
                    return
                  }

                  state.setMarket(activeMarket)
                  state.setOutcome(buyYesOutcome)
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <span className="truncate opacity-70">
                  {t('Buy')}
                  {' '}
                  {buyYesOutcomeLabel}
                </span>
                <span className="shrink-0 font-bold">
                  {yesPriceLabel}
                </span>
              </Button>
              <Button
                variant="no"
                size="outcomeLg"
                onClick={() => {
                  if (!activeMarket || !buyNoOutcome) {
                    return
                  }

                  state.setMarket(activeMarket)
                  state.setOutcome(buyNoOutcome)
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <span className="truncate opacity-70">
                  {t('Buy')}
                  {' '}
                  {buyNoOutcomeLabel}
                </span>
                <span className="shrink-0 font-bold">
                  {noPriceLabel}
                </span>
              </Button>
            </div>
          </div>
        </DrawerTrigger>
      )}

      <DrawerContent className="max-h-[95vh] w-full">
        <VisuallyHidden>
          <DialogTitle>{event.title}</DialogTitle>
        </VisuallyHidden>

        <EventOrderPanelForm
          event={event}
          isMobile={true}
          initialMarket={activeMarket}
          initialOutcome={activeOutcome}
          mobileMarketInfo={mobileMarketInfo}
          primaryOutcomeIndex={primaryOutcomeIndex}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant={outcomeButtonStyleVariant}
          optimisticallyClaimedConditionIds={optimisticallyClaimedConditionIds}
        />
        <EventOrderPanelTermsDisclaimer />
      </DrawerContent>
    </Drawer>
  )
}
