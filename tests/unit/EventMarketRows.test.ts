import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import { buildEventMarketRows } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { OUTCOME_INDEX } from '@/lib/constants'

describe('buildEventMarketRows', () => {
  let marketCounter = 0

  function createMarket(overrides: Record<string, any> = {}) {
    marketCounter += 1
    return {
      condition_id: overrides.condition_id ?? `market-${marketCounter}`,
      title: overrides.title ?? 'Market',
      icon_url: overrides.icon_url ?? null,
      volume: overrides.volume ?? 0,
      probability: overrides.probability ?? 50,
      outcomes: overrides.outcomes ?? [
        {
          outcome_index: OUTCOME_INDEX.YES,
          outcome_text: 'Yes',
          buy_price: 0.6,
          token_id: 'yes-token',
        },
        {
          outcome_index: OUTCOME_INDEX.NO,
          outcome_text: 'No',
          buy_price: 0.4,
          token_id: 'no-token',
        },
      ],
    }
  }

  function createEvent(markets: Array<Record<string, any>>): Event {
    return {
      id: 'event-1',
      slug: 'event-1',
      title: 'Test Event',
      created_at: new Date().toISOString(),
      markets,
    } as unknown as Event
  }

  it('flags missing chance data but still builds placeholder rows', () => {
    const event = createEvent([
      createMarket({ condition_id: 'm1' }),
      createMarket({ condition_id: 'm2' }),
    ])

    const result = buildEventMarketRows(event, {
      outcomeChances: { m1: 60 },
      outcomeChanceChanges: {},
      marketYesPrices: {},
    })

    expect(result.hasChanceData).toBe(false)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.market.condition_id).toBe('m1')
    expect(result.rows[0]?.chanceMeta.chanceDisplay).toBe('60%')
    expect(result.rows[1]?.market.condition_id).toBe('m2')
    expect(result.rows[1]?.chanceMeta.chanceDisplay).toBe('—')
  })

  it('clamps yes/no price overrides within bounds', () => {
    const event = createEvent([
      createMarket({ condition_id: 'm1' }),
    ])

    const result = buildEventMarketRows(event, {
      outcomeChances: { m1: 55 },
      outcomeChanceChanges: { m1: 0 },
      marketYesPrices: { m1: 1.5 },
    })

    expect(result.hasChanceData).toBe(true)
    expect(result.rows[0]?.yesPriceValue).toBe(1)
    expect(result.rows[0]?.noPriceValue).toBe(0)
  })

  it('sorts markets in descending chance order', () => {
    const event = createEvent([
      createMarket({ condition_id: 'm1', title: 'First' }),
      createMarket({ condition_id: 'm2', title: 'Second' }),
    ])

    const result = buildEventMarketRows(event, {
      outcomeChances: { m1: 25, m2: 75 },
      outcomeChanceChanges: { m1: 0, m2: 0 },
      marketYesPrices: {},
    })

    expect(result.rows.map(row => row.market.condition_id)).toEqual(['m2', 'm1'])
  })

  it('displays <1% for any chance below 1, including zero', () => {
    const event = createEvent([
      createMarket({ condition_id: 'm0', title: 'Zero' }),
      createMarket({ condition_id: 'm095', title: 'Zero Point Ninety Five' }),
      createMarket({ condition_id: 'm1', title: 'One' }),
    ])

    const result = buildEventMarketRows(event, {
      outcomeChances: { m0: 0, m095: 0.95, m1: 1 },
      outcomeChanceChanges: { m0: 0, m095: 0, m1: 0 },
      marketYesPrices: {},
    })

    const byId = Object.fromEntries(result.rows.map(row => [row.market.condition_id, row]))

    expect(byId.m0?.chanceMeta.chanceDisplay).toBe('<1%')
    expect(byId.m095?.chanceMeta.chanceDisplay).toBe('<1%')
    expect(byId.m1?.chanceMeta.chanceDisplay).toBe('1%')
  })
})
