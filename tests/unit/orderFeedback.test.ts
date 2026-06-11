import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleOrderSuccessFeedback } from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventTradeToast', () => ({
  default: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/lib/utils', () => ({
  triggerConfetti: vi.fn(),
}))

describe('handleOrderSuccessFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses buyAmountValue when provided for buy success copy', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    handleOrderSuccessFeedback({
      side: ORDER_SIDE.BUY,
      amountInput: '0.19',
      buyAmountValue: 9.9,
      buySharesLabel: '10',
      isLimitOrder: false,
      outcomeText: 'No',
      eventTitle: 'Event',
      marketImage: undefined,
      marketTitle: 'Market',
      sellAmountValue: 0,
      avgSellPrice: '—',
      buyPrice: 99,
      queryClient: queryClient as any,
      outcomeIndex: OUTCOME_INDEX.NO,
      lastMouseEvent: null,
    })

    expect(toast.success).toHaveBeenCalledWith(
      'Buy 10 shares on No',
      expect.any(Object),
    )
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user-conditional-shares'],
    })
  })

  it('formats limit order toast prices from cents', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    handleOrderSuccessFeedback({
      side: ORDER_SIDE.BUY,
      amountInput: '0.1',
      buyAmountValue: 0.1,
      buySharesLabel: '10',
      isLimitOrder: true,
      outcomeText: 'Yes',
      eventTitle: 'Event',
      marketImage: undefined,
      marketTitle: 'Market',
      sellAmountValue: 0,
      avgSellPrice: '—',
      buyPrice: 1,
      queryClient: queryClient as any,
      outcomeIndex: OUTCOME_INDEX.YES,
      lastMouseEvent: null,
    })

    const [, options] = vi.mocked(toast.success).mock.calls[0]
    const children = (options as any).description.props.children
    expect(children.join('')).toBe('Total 10¢ @ 1¢')
  })
})
