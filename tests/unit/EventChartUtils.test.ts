import { describe, expect, it } from 'bun:test'

import {
  buildHistoryWithLatestPointOverride,
  getSportsMoneylineMarketIds,
  resolveChartRangeStartMs,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'

describe('eventChartUtils', () => {
  it('builds a flat series across the selected range when only a current quote exists', () => {
    const start = new Date('2026-07-30T12:00:00.000Z')
    const end = new Date('2026-07-30T13:00:00.000Z')

    expect(buildHistoryWithLatestPointOverride([], { market: 50 }, end.getTime(), start.getTime())).toEqual([
      { date: start, market: 50 },
      { date: end, market: 50 },
    ])
  })

  it('anchors quote-only charts to the selected time range without preceding event creation', () => {
    const createdAt = '2026-07-30T12:30:00.000Z'
    const end = new Date('2026-07-30T14:00:00.000Z')

    expect(resolveChartRangeStartMs('ALL', createdAt, end.getTime())).toBe(Date.parse(createdAt))
    expect(resolveChartRangeStartMs('1H', createdAt, end.getTime())).toBe(Date.parse('2026-07-30T13:00:00.000Z'))
    expect(resolveChartRangeStartMs('6H', createdAt, end.getTime())).toBe(Date.parse(createdAt))
  })

  it('extends an unchanged price through the chart end', () => {
    const start = new Date('2026-07-30T12:00:00.000Z')
    const end = new Date('2026-07-30T13:00:00.000Z')

    expect(buildHistoryWithLatestPointOverride([{ date: start, market: 42 }], { market: 42 }, end.getTime())).toEqual([
      { date: start, market: 42 },
      { date: end, market: 42 },
    ])
  })

  it('extends the last known values when live quotes are unavailable', () => {
    const start = new Date('2026-07-30T12:00:00.000Z')
    const end = new Date('2026-07-30T13:00:00.000Z')

    expect(buildHistoryWithLatestPointOverride([{ date: start, first: 35, second: 65 }], {}, end.getTime())).toEqual([
      { date: start, first: 35, second: 65 },
      { date: end, first: 35, second: 65 },
    ])
  })

  it('uses the resolved chart end instead of adding a later point', () => {
    const resolvedAt = new Date('2026-07-30T13:00:00.000Z')
    const laterNow = new Date('2026-07-30T14:00:00.000Z')
    const history = [
      { date: new Date('2026-07-30T12:00:00.000Z'), market: 42 },
      { date: resolvedAt, market: 58 },
    ]

    expect(buildHistoryWithLatestPointOverride(history, { market: 58 }, resolvedAt.getTime())).toBe(history)
    expect(buildHistoryWithLatestPointOverride(history, { market: 58 }, laterNow.getTime())).toEqual([
      ...history,
      { date: laterNow, market: 58 },
    ])
  })

  it('uses separated sports moneyline markets in team draw team order', () => {
    const event = {
      sports_sport_slug: 'soccer',
      sports_tags: ['games', 'fifwc'],
      tags: [],
      main_tag: 'games',
      sports_teams: [
        {
          name: 'United States',
          abbreviation: 'USA',
          host_status: 'home',
        },
        {
          name: 'Belgium',
          abbreviation: 'BEL',
          host_status: 'away',
        },
      ],
      markets: [
        {
          condition_id: 'united-states-market',
          sports_market_type: 'moneyline',
          short_title: 'United States',
          title: 'United States',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
        {
          condition_id: 'belgium-market',
          sports_market_type: 'moneyline',
          short_title: 'Belgium',
          title: 'Belgium',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
        {
          condition_id: 'draw-market',
          sports_market_type: 'moneyline',
          short_title: 'Draw',
          title: 'Draw',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
      ],
    } as any

    expect(getSportsMoneylineMarketIds(event)).toEqual(['united-states-market', 'draw-market', 'belgium-market'])
  })

  it('deduplicates binary sports moneyline outcome markets', () => {
    const event = {
      sports_sport_slug: 'soccer',
      sports_tags: ['games'],
      tags: [],
      main_tag: 'games',
      sports_teams: [
        {
          name: 'United States',
          abbreviation: 'USA',
          host_status: 'home',
        },
        {
          name: 'Belgium',
          abbreviation: 'BEL',
          host_status: 'away',
        },
      ],
      markets: [
        {
          condition_id: 'match-winner-market',
          sports_market_type: 'moneyline',
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            { outcome_index: 0, outcome_text: 'United States' },
            { outcome_index: 1, outcome_text: 'Belgium' },
          ],
        },
      ],
    } as any

    expect(getSportsMoneylineMarketIds(event)).toEqual(['match-winner-market'])
  })
})
