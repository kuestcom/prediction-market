import { resolvePositionCostValue } from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-utils'

describe('sports position cost', () => {
  it('prefers explicit total bought over derived shares times average price', () => {
    const position = {
      totalBought: 10,
    }

    expect(resolvePositionCostValue(position as any, 20.4, 0.5)).toBe(10)
  })

  it('normalizes stored micro-unit position cost', () => {
    const position = {
      total_position_cost: 10_200_000,
    }

    expect(resolvePositionCostValue(position as any, 0, null)).toBe(10.2)
  })
})
