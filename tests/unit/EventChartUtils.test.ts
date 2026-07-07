import { getSportsMoneylineMarketIds } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'

describe('eventChartUtils', () => {
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

    expect(getSportsMoneylineMarketIds(event)).toEqual([
      'united-states-market',
      'draw-market',
      'belgium-market',
    ])
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
