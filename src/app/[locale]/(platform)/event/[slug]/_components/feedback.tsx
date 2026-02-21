import type { QueryClient } from '@tanstack/react-query'
import type { OrderValidationError } from '@/lib/orders/validation'
import type { OrderSide } from '@/types'
import { toast } from 'sonner'
import EventTradeToast from '@/app/[locale]/(platform)/event/[slug]/_components/EventTradeToast'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel, formatCurrency } from '@/lib/formatters'
import { triggerConfetti } from '@/lib/utils'

interface HandleValidationErrorArgs {
  openWalletModal: () => Promise<void> | void
  shareLabel?: string
}

interface OrderSuccessFeedbackArgs {
  side: OrderSide
  amountInput: string
  sellSharesLabel?: string
  isLimitOrder?: boolean
  outcomeText: string
  eventTitle: string
  marketImage?: string
  marketTitle?: string
  sellAmountValue: number
  avgSellPrice: string
  buyPrice?: number
  queryClient: QueryClient
  outcomeIndex: number
  lastMouseEvent: any
}

export function handleValidationError(reason: OrderValidationError, { openWalletModal, shareLabel }: HandleValidationErrorArgs) {
  switch (reason) {
    case 'IS_LOADING':
      toast.info('Order already processing')
      break
    case 'NOT_CONNECTED':
      toast.error('Connect your wallet to continue.')
      queueMicrotask(() => openWalletModal())
      break
    case 'MISSING_USER':
      toast.error('Sign in to place orders.')
      queueMicrotask(() => openWalletModal())
      break
    case 'MISSING_MARKET':
    case 'MISSING_OUTCOME':
      toast.error('Market not available', {
        description: 'Please select a valid market and outcome.',
      })
      break
    case 'INVALID_AMOUNT':
      toast.error('Invalid amount', {
        description: 'Please enter an amount greater than 0.',
      })
      break
    case 'INVALID_LIMIT_PRICE':
      toast.error('Invalid limit price', {
        description: 'Enter a valid limit price before submitting.',
      })
      break
    case 'INVALID_LIMIT_SHARES':
      toast.error('Invalid shares', {
        description: 'Enter the number of shares for your limit order.',
      })
      break
    case 'INVALID_LIMIT_EXPIRATION':
      toast.error('Expiration must be in future. Try again', {
        description: 'Pick a future date and time for your custom expiration.',
      })
      break
    case 'MARKET_MIN_AMOUNT':
      toast.error('Market buys must be at least $1')
      break
    case 'INSUFFICIENT_BALANCE':
      toast.error('Insufficient balance', {
        description: 'Reduce the order size or deposit more into your Safe.',
      })
      break
    case 'INSUFFICIENT_SHARES': {
      const title = shareLabel ? `Insufficient ${shareLabel} shares` : 'Insufficient shares'
      toast.error(title, {
        description: 'Reduce the order size or split more shares before selling.',
      })
      break
    }
    default:
      toast.error('Unable to submit order. Please review your inputs.')
  }
}

export function handleOrderSuccessFeedback({
  side,
  amountInput,
  sellSharesLabel,
  isLimitOrder,
  outcomeText,
  eventTitle,
  marketImage,
  marketTitle,
  sellAmountValue,
  avgSellPrice,
  buyPrice,
  queryClient,
  outcomeIndex,
  lastMouseEvent,
}: OrderSuccessFeedbackArgs) {
  if (side === ORDER_SIDE.SELL) {
    const displayShares = sellSharesLabel && sellSharesLabel.trim().length > 0
      ? sellSharesLabel.trim()
      : amountInput
    const amountPrefix = isLimitOrder ? 'Total' : 'Received'
    toast.success(
      `Sell ${displayShares} shares on ${outcomeText}`,
      {
        description: (
          <EventTradeToast title={eventTitle} marketImage={marketImage} marketTitle={marketTitle}>
            {amountPrefix}
            {' '}
            {formatCurrency(sellAmountValue)}
            {' '}
            @
            {' '}
            {avgSellPrice}
          </EventTradeToast>
        ),
      },
    )
  }
  else {
    const amountValue = Number.parseFloat(amountInput || '0') || 0
    const buyAmountLabel = formatCurrency(amountValue)
    const priceLabel = formatCentsLabel(buyPrice, { fallback: '—' })

    toast.success(
      `Buy ${buyAmountLabel} on ${outcomeText}`,
      {
        description: (
          <EventTradeToast title={eventTitle} marketImage={marketImage} marketTitle={marketTitle}>
            at
            {' '}
            {priceLabel}
          </EventTradeToast>
        ),
      },
    )
  }

  triggerConfetti(outcomeIndex === OUTCOME_INDEX.YES ? 'yes' : 'no', lastMouseEvent)

  void queryClient.invalidateQueries({
    queryKey: ['user-conditional-shares'],
  })
}

export function handleOrderErrorFeedback(message: string, description?: string) {
  toast.error(message, description ? { description } : undefined)
}

export function handleOrderCancelledFeedback() {
  toast.error('Trade cancelled', {
    description: 'You rejected the request in your wallet.',
  })
}
