import type { ReactNode } from 'react'
import type { OddsFormat } from '@/lib/odds-format'
import type { Event } from '@/types'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useExtracted } from 'next-intl'
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
  showDefaultTrigger?: boolean
  mobileMarketInfo?: ReactNode
  primaryOutcomeIndex?: number | null
  oddsFormat?: OddsFormat
  outcomeButtonStyleVariant?: 'default' | 'sports3d'
}

export default function EventOrderPanelMobile({
  event,
  showDefaultTrigger = true,
  mobileMarketInfo,
  primaryOutcomeIndex = null,
  oddsFormat = 'price',
  outcomeButtonStyleVariant = 'default',
}: EventMobileOrderPanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const state = useOrder()
  const isSingleMarket = useIsSingleMarket()
  const yesPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.YES, ORDER_SIDE.BUY)
  const noPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.NO, ORDER_SIDE.BUY)
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
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-4 lg:hidden">
            <div className="flex gap-2">
              <Button
                variant="yes"
                size="outcomeLg"
                onClick={() => {
                  if (!state.market) {
                    return
                  }

                  state.setOutcome(state.market.outcomes[0])
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <span className="truncate opacity-70">
                  {t('Buy')}
                  {' '}
                  {normalizeOutcomeLabel(state.market!.outcomes[0].outcome_text) ?? state.market!.outcomes[0].outcome_text}
                </span>
                <span className="shrink-0 font-bold">
                  {yesPriceLabel}
                </span>
              </Button>
              <Button
                variant="no"
                size="outcomeLg"
                onClick={() => {
                  if (!state.market) {
                    return
                  }

                  state.setOutcome(state.market.outcomes[1])
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <span className="truncate opacity-70">
                  {t('Buy')}
                  {' '}
                  {normalizeOutcomeLabel(state.market!.outcomes[1].outcome_text) ?? state.market!.outcomes[1].outcome_text}
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
          mobileMarketInfo={mobileMarketInfo}
          primaryOutcomeIndex={primaryOutcomeIndex}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant={outcomeButtonStyleVariant}
        />
        <EventOrderPanelTermsDisclaimer />
      </DrawerContent>
    </Drawer>
  )
}
