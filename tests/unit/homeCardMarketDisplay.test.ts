import { describe, expect, it } from 'bun:test'

import { hasHomeCardMarketChance } from '@/app/[locale]/(platform)/(home)/_utils/homeCardMarketDisplay'

function createMarket(overrides: Record<string, unknown> = {}) {
  return {
    volume: 0,
    volume_24h: 0,
    outcomes: [],
    condition: {
      volume: 0,
    },
    ...overrides,
  } as any
}

describe('home card market chance availability', () => {
  it('is unavailable without quotes, trades, or matched volume', () => {
    expect(hasHomeCardMarketChance(createMarket())).toBe(false)
  })

  it('is available from a planted order without matched volume', () => {
    expect(
      hasHomeCardMarketChance(
        createMarket({
          outcomes: [{ buy_price: 0.64 }],
        }),
      ),
    ).toBe(true)
  })

  it('is available from a last trade even when aggregate volume is delayed', () => {
    expect(
      hasHomeCardMarketChance(
        createMarket({
          outcomes: [{ last_trade_price: 0.61 }],
        }),
      ),
    ).toBe(true)
  })

  it('is available from a live price override', () => {
    expect(hasHomeCardMarketChance(createMarket(), 0.58)).toBe(true)
  })
})
