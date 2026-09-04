import type { QueryClient } from '@tanstack/react-query'

import type { OrderValidationError } from '@/lib/orders/validation'
import type { OrderSide } from '@/types'

import EventTradeToast from '@/app/[locale]/(platform)/event/[slug]/_components/EventTradeToast'
import { toast } from '@/components/ui/toast'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsValueLabel, formatDollarValueLabel } from '@/lib/formatters'
import { triggerConfetti } from '@/lib/utils'

type Translate = (message: string, values?: Record<string, string | number | Date>) => string

function defaultTranslate(message: string, values?: Record<string, string | number | Date>) {
  return message.replace(/\{(\w+)\}/g, (placeholder, key) => {
    const value = values?.[key]
    return value == null ? placeholder : String(value)
  })
}

interface HandleValidationErrorArgs {
  openWalletModal: () => Promise<void> | void
  shareLabel?: string
  translate: Translate
}

interface OrderSuccessFeedbackArgs {
  side: OrderSide
  amountInput: string
  buyAmountValue?: number
  buySharesLabel?: string
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
  translate?: Translate
}

export function handleValidationError(
  reason: OrderValidationError,
  { openWalletModal, shareLabel, translate }: HandleValidationErrorArgs,
) {
  switch (reason) {
    case 'IS_LOADING':
      toast.info(translate('Order already processing'))
      break
    case 'NOT_CONNECTED':
      toast.error(translate('Connect your wallet to continue.'))
      void openWalletModal()
      break
    case 'MISSING_USER':
      toast.error(translate('Sign in to place orders.'))
      void openWalletModal()
      break
    case 'MISSING_MARKET':
    case 'MISSING_OUTCOME':
      toast.error(translate('Market not available'), {
        description: translate('Please select a valid market and outcome.'),
      })
      break
    case 'INVALID_AMOUNT':
      toast.error(translate('Invalid amount'), {
        description: translate('Please enter an amount greater than 0.'),
      })
      break
    case 'INVALID_LIMIT_PRICE':
      toast.error(translate('Invalid limit price'), {
        description: translate('Enter a valid limit price before submitting.'),
      })
      break
    case 'INVALID_LIMIT_SHARES':
      toast.error(translate('Invalid shares'), {
        description: translate('Enter the number of shares for your limit order.'),
      })
      break
    case 'INVALID_LIMIT_EXPIRATION':
      toast.error(translate('Expiration must be in future. Try again'), {
        description: translate('Pick a future date and time for your custom expiration.'),
      })
      break
    case 'MARKET_MIN_AMOUNT':
      toast.error(translate('Market buys must be at least $1'))
      break
    case 'INSUFFICIENT_BALANCE':
      toast.error(translate('Insufficient balance'), {
        description: translate('Reduce the order size or deposit more into your Deposit Wallet.'),
      })
      break
    case 'INSUFFICIENT_SHARES': {
      const title = shareLabel
        ? translate('Insufficient {shareLabel} shares', { shareLabel })
        : translate('Insufficient shares')
      toast.error(title, {
        description: translate('Reduce the order size or split more shares before selling.'),
      })
      break
    }
    default:
      toast.error(translate('Unable to submit order. Please review your inputs.'))
  }
}

export function handleOrderSuccessFeedback({
  side,
  amountInput,
  buyAmountValue,
  buySharesLabel,
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
  translate = defaultTranslate,
}: OrderSuccessFeedbackArgs) {
  if (side === ORDER_SIDE.SELL) {
    const displayShares = sellSharesLabel && sellSharesLabel.trim().length > 0 ? sellSharesLabel.trim() : amountInput
    const amountPrefix = isLimitOrder ? translate('Total') : translate('Received')
    toast.success(translate('Sell {shares} shares on {outcome}', { shares: displayShares, outcome: outcomeText }), {
      description: (
        <EventTradeToast title={eventTitle} marketImage={marketImage} marketTitle={marketTitle}>
          {translate('{label} {amount} @ {price}', {
            label: amountPrefix,
            amount: formatDollarValueLabel(sellAmountValue, { fallback: '0¢' }),
            price: avgSellPrice,
          })}
        </EventTradeToast>
      ),
    })
  } else {
    const amountValue = typeof buyAmountValue === 'number' ? buyAmountValue : Number.parseFloat(amountInput || '0') || 0
    const normalizedBuySharesLabel = buySharesLabel?.trim()
    const buyAmountLabel = formatDollarValueLabel(amountValue, { fallback: '0¢' })
    const priceLabel = formatCentsValueLabel(buyPrice, { fallback: '—' })

    toast.success(
      normalizedBuySharesLabel
        ? translate('Buy {shares} shares on {outcome}', { shares: normalizedBuySharesLabel, outcome: outcomeText })
        : translate('Buy {amount} on {outcome}', { amount: buyAmountLabel, outcome: outcomeText }),
      {
        description: (
          <EventTradeToast title={eventTitle} marketImage={marketImage} marketTitle={marketTitle}>
            {translate('{label} {amount} @ {price}', {
              label: translate('Total'),
              amount: buyAmountLabel,
              price: priceLabel,
            })}
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

export function handleOrderCancelledFeedback(translate: Translate) {
  toast.error(translate('Trade cancelled'), {
    description: translate('You rejected the request in your wallet.'),
  })
}
