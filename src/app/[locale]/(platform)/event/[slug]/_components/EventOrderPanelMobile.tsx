import type { Event } from '@/types'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useExtracted } from 'next-intl'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel } from '@/lib/formatters'
import { useIsSingleMarket, useOrder, useOutcomeTopOfBookPrice } from '@/stores/useOrder'

interface EventMobileOrderPanelProps {
  event: Event
}

export default function EventOrderPanelMobile({ event }: EventMobileOrderPanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const state = useOrder()
  const isSingleMarket = useIsSingleMarket()
  const yesPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.YES, ORDER_SIDE.BUY)
  const noPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.NO, ORDER_SIDE.BUY)

  return (
    <Drawer
      open={state.isMobileOrderPanelOpen}
      onClose={() => state.setIsMobileOrderPanelOpen(false)}
      repositionInputs={false}
    >
      <DrawerTrigger asChild>
        {isSingleMarket && (
          <div className="fixed right-0 bottom-0 left-0 z-30 border-t bg-background p-4 lg:hidden">
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
                  {formatCentsLabel(yesPrice)}
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
                  {formatCentsLabel(noPrice)}
                </span>
              </Button>
            </div>
          </div>
        )}
      </DrawerTrigger>

      <DrawerContent className="overflow-y-auto">
        <VisuallyHidden>
          <DialogTitle>{event.title}</DialogTitle>
        </VisuallyHidden>

        <EventOrderPanelForm event={event} isMobile={true} />
      </DrawerContent>
    </Drawer>
  )
}
