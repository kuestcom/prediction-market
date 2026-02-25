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
})
