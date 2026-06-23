import { resolveSelectedOrderBookTradeLabel } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-utils'

describe('sports order-book trade label', () => {
  it('uses the displayed moneyline button abbreviation for team outcomes', () => {
    const button = {
      key: 'scotland-moneyline',
      conditionId: 'match-winner',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'SCO',
      cents: 42,
      color: null,
      marketType: 'moneyline',
      tone: 'team1',
    } as const

    const outcome = {
      outcome_index: 0,
      outcome_text: 'Scotland',
    }

    expect(resolveSelectedOrderBookTradeLabel(button, outcome as any)).toBe('SCO')
  })

  it('preserves total side and line labels', () => {
    const button = {
      key: 'total-over-2-5',
      conditionId: 'total-goals',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'O 2.5',
      cents: 54,
      color: null,
      marketType: 'total',
      tone: 'over',
    } as const

    const outcome = {
      outcome_index: 0,
      outcome_text: 'Over',
    }

    expect(resolveSelectedOrderBookTradeLabel(button, outcome as any)).toBe('OVER 2.5')
  })
})
