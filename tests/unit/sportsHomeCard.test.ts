import {
  buildHomeSportsMoneylineModel,
  resolveHomeSportsButtonChance,
  resolveResolvedHomeSportsMoneylineWinner,
} from '@/lib/sports-home-card'

describe('sportsHomeCard', () => {
  it('builds a home sports moneyline model for non-neg-risk binary match winner markets', () => {
    const event = {
      sports_sport_slug: 'cs2',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Liquid',
          abbreviation: 'TL',
          color: '#1d4ed8',
          host_status: 'home',
          logo_url: 'https://example.com/liquid.png',
        },
        {
          name: 'BESTIA',
          abbreviation: 'BST',
          color: '#dc2626',
          host_status: 'away',
          logo_url: 'https://example.com/bestia.png',
        },
      ],
      sports_team_logo_urls: null,
      markets: [
        {
          condition_id: 'match-winner-condition',
          sports_market_type: null,
          sports_group_item_title: null,
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Liquid',
            },
            {
              outcome_index: 1,
              outcome_text: 'BESTIA',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1.name).toBe('Liquid')
    expect(model?.team2.name).toBe('BESTIA')
    expect(model?.team1Button.conditionId).toBe('match-winner-condition')
    expect(model?.team2Button.conditionId).toBe('match-winner-condition')
    expect(model?.team1Button.outcomeIndex).toBe(0)
    expect(model?.team2Button.outcomeIndex).toBe(1)
    expect(model?.team1Button.color).toBe('#1d4ed8')
    expect(model?.team2Button.color).toBe('#dc2626')
    expect(model?.drawButton).toBeUndefined()
  })

  it('preserves draw button support for separated neg-risk moneyline markets', () => {
    const event = {
      sports_sport_slug: 'soccer',
      neg_risk: true,
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Arsenal',
          abbreviation: 'ARS',
          color: '#ef4444',
          host_status: 'home',
        },
        {
          name: 'Chelsea',
          abbreviation: 'CHE',
          color: '#2563eb',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: null,
      markets: [
        {
          condition_id: 'arsenal-market',
          sports_market_type: 'moneyline',
          sports_group_item_title: null,
          short_title: 'Arsenal',
          title: 'Arsenal',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
            },
          ],
        },
        {
          condition_id: 'draw-market',
          sports_market_type: 'moneyline',
          sports_group_item_title: null,
          short_title: 'Draw',
          title: 'Draw',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
            },
          ],
        },
        {
          condition_id: 'chelsea-market',
          sports_market_type: 'moneyline',
          sports_group_item_title: null,
          short_title: 'Chelsea',
          title: 'Chelsea',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1Button.conditionId).toBe('arsenal-market')
    expect(model?.team2Button.conditionId).toBe('chelsea-market')
    expect(model?.drawButton?.conditionId).toBe('draw-market')
  })

  it('resolves the winning sports moneyline button for binary markets', () => {
    const event = {
      sports_sport_slug: 'cs2',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Liquid',
          abbreviation: 'TL',
          color: '#1d4ed8',
          host_status: 'home',
        },
        {
          name: 'BESTIA',
          abbreviation: 'BST',
          color: '#dc2626',
          host_status: 'away',
        },
      ],
      markets: [
        {
          condition_id: 'match-winner-condition',
          sports_market_type: null,
          sports_group_item_title: null,
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Liquid',
              is_winning_outcome: true,
            },
            {
              outcome_index: 1,
              outcome_text: 'BESTIA',
              is_winning_outcome: false,
            },
          ],
          condition: {
            payout_numerators: [1, 0],
          },
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(resolveResolvedHomeSportsMoneylineWinner(event, model!)).toEqual({
      conditionId: 'match-winner-condition',
      label: 'Liquid',
      outcomeIndex: 0,
      tone: 'team1',
    })
  })

  it('resolves draw as the winning sports moneyline button for separated neg-risk markets', () => {
    const event = {
      sports_sport_slug: 'soccer',
      neg_risk: true,
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Arsenal',
          abbreviation: 'ARS',
          color: '#ef4444',
          host_status: 'home',
        },
        {
          name: 'Chelsea',
          abbreviation: 'CHE',
          color: '#2563eb',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: null,
      markets: [
        {
          condition_id: 'arsenal-market',
          sports_market_type: 'moneyline',
          short_title: 'Arsenal',
          title: 'Arsenal',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
              is_winning_outcome: false,
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
              is_winning_outcome: true,
            },
          ],
          condition: {
            payout_numerators: [0, 1],
          },
        },
        {
          condition_id: 'draw-market',
          sports_market_type: 'moneyline',
          short_title: 'Draw',
          title: 'Draw',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
              is_winning_outcome: true,
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
              is_winning_outcome: false,
            },
          ],
          condition: {
            payout_numerators: [1, 0],
          },
        },
        {
          condition_id: 'chelsea-market',
          sports_market_type: 'moneyline',
          short_title: 'Chelsea',
          title: 'Chelsea',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
              is_winning_outcome: false,
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
              is_winning_outcome: true,
            },
          ],
          condition: {
            payout_numerators: [0, 1],
          },
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(resolveResolvedHomeSportsMoneylineWinner(event, model!)).toEqual({
      conditionId: 'draw-market',
      label: 'Draw',
      outcomeIndex: 0,
      tone: 'draw',
    })
  })

  it('falls back to the sports score when separated moneyline markets have no explicit winner', () => {
    const event = {
      sports_score: '2 - 1',
      sports_sport_slug: 'soccer',
      neg_risk: true,
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Santos FC',
          abbreviation: 'SAN',
          color: '#111827',
          host_status: 'home',
        },
        {
          name: 'CR Vasco da Gama',
          abbreviation: 'VAS',
          color: '#16a34a',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: null,
      markets: [
        {
          condition_id: 'santos-market',
          sports_market_type: 'moneyline',
          short_title: 'Santos FC',
          title: 'Will Santos FC win?',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
        {
          condition_id: 'draw-market',
          sports_market_type: 'moneyline',
          short_title: 'Draw',
          title: 'Will the match end in a draw?',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
        {
          condition_id: 'vasco-market',
          sports_market_type: 'moneyline',
          short_title: 'CR Vasco da Gama',
          title: 'Will CR Vasco da Gama win?',
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes' },
            { outcome_index: 1, outcome_text: 'No' },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(resolveResolvedHomeSportsMoneylineWinner(event, model!)).toEqual({
      conditionId: 'santos-market',
      label: 'Santos FC',
      outcomeIndex: 0,
      tone: 'team1',
    })
  })

  it('does not map non-neg-risk separated yes/no moneylines as a binary market', () => {
    const event = {
      sports_sport_slug: 'soccer',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Arsenal',
          abbreviation: 'ARS',
          color: '#ef4444',
          host_status: 'home',
        },
        {
          name: 'Chelsea',
          abbreviation: 'CHE',
          color: '#2563eb',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: null,
      markets: [
        {
          condition_id: 'arsenal-market',
          sports_market_type: 'moneyline',
          sports_group_item_title: null,
          short_title: 'Arsenal',
          title: 'Arsenal',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
            },
          ],
        },
        {
          condition_id: 'chelsea-market',
          sports_market_type: 'moneyline',
          sports_group_item_title: null,
          short_title: 'Chelsea',
          title: 'Chelsea',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Yes',
            },
            {
              outcome_index: 1,
              outcome_text: 'No',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1Button.conditionId).toBe('arsenal-market')
    expect(model?.team1Button.outcomeIndex).toBe(0)
    expect(model?.team2Button.conditionId).toBe('chelsea-market')
    expect(model?.team2Button.outcomeIndex).toBe(0)
    expect(model?.drawButton).toBeUndefined()
  })

  it('does not reuse the other team logo when home card logo data is incomplete', () => {
    const zimbabweLogoUrl = 'https://example.com/zimbabwe.png'
    const event = {
      sports_sport_slug: 'cricket',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Nigeria',
          abbreviation: 'NGA',
          host_status: 'home',
        },
        {
          name: 'Zimbabwe',
          abbreviation: 'ZWE',
          host_status: 'away',
          logo_url: zimbabweLogoUrl,
        },
      ],
      sports_team_logo_urls: [zimbabweLogoUrl],
      markets: [
        {
          condition_id: 'match-winner-condition',
          sports_market_type: null,
          sports_group_item_title: null,
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Nigeria',
            },
            {
              outcome_index: 1,
              outcome_text: 'Zimbabwe',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1.logoUrl).toBeNull()
    expect(model?.team2.logoUrl).toBe(zimbabweLogoUrl)
  })

  it('does not use indexed logo fallback when unnamed teams make the logo array ambiguous', () => {
    const nigeriaLogoUrl = 'https://example.com/nigeria.png'
    const zimbabweLogoUrl = 'https://example.com/zimbabwe.png'
    const event = {
      sports_sport_slug: 'cricket',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: '',
          abbreviation: '',
          host_status: null,
        },
        {
          name: 'Nigeria',
          abbreviation: 'NGA',
          host_status: 'home',
        },
        {
          name: 'Zimbabwe',
          abbreviation: 'ZWE',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: [nigeriaLogoUrl, zimbabweLogoUrl],
      markets: [
        {
          condition_id: 'match-winner-condition',
          sports_market_type: null,
          sports_group_item_title: null,
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Nigeria',
            },
            {
              outcome_index: 1,
              outcome_text: 'Zimbabwe',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1.logoUrl).toBeNull()
    expect(model?.team2.logoUrl).toBeNull()
  })

  it('uses indexed logo fallback when the raw team list is fully named and positional', () => {
    const nigeriaLogoUrl = 'https://example.com/nigeria.png'
    const zimbabweLogoUrl = 'https://example.com/zimbabwe.png'
    const event = {
      sports_sport_slug: 'cricket',
      main_tag: 'games',
      tags: [
        {
          id: 1,
          name: 'Games',
          slug: 'games',
          isMainCategory: true,
        },
      ],
      sports_teams: [
        {
          name: 'Nigeria',
          abbreviation: 'NGA',
          host_status: 'home',
        },
        {
          name: 'Zimbabwe',
          abbreviation: 'ZWE',
          host_status: 'away',
        },
      ],
      sports_team_logo_urls: [nigeriaLogoUrl, zimbabweLogoUrl],
      markets: [
        {
          condition_id: 'match-winner-condition',
          sports_market_type: null,
          sports_group_item_title: null,
          short_title: 'Match Winner',
          title: 'Match Winner',
          outcomes: [
            {
              outcome_index: 0,
              outcome_text: 'Nigeria',
            },
            {
              outcome_index: 1,
              outcome_text: 'Zimbabwe',
            },
          ],
        },
      ],
    } as any

    const model = buildHomeSportsMoneylineModel(event)

    expect(model).not.toBeNull()
    expect(model?.team1.logoUrl).toBe(nigeriaLogoUrl)
    expect(model?.team2.logoUrl).toBe(zimbabweLogoUrl)
  })

  it('resolves display chance by outcome index', () => {
    expect(resolveHomeSportsButtonChance(63, 0)).toBe(63)
    expect(resolveHomeSportsButtonChance(63, 1)).toBe(37)
  })
})
