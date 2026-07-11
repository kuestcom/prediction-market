import {
  resolveSelectedOrderBookTradeLabel,
  resolveSelectedTradeLabel,
  resolveTradeHeaderTitle,
} from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-utils'

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

  it('uses title case total labels for order panel selections', () => {
    const card = { teams: [] } as any
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

    expect(resolveSelectedTradeLabel(card, button, outcome as any)).toBe('Over 2.5')
  })

  it('uses title case fallback labels for order panel selections', () => {
    const card = { teams: [] } as any
    const button = {
      key: 'extra-time-yes',
      conditionId: 'extra-time',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'YES',
      cents: 54,
      color: null,
      marketType: 'binary',
      tone: 'over',
    } as const

    expect(resolveSelectedTradeLabel(card, button, null)).toBe('Yes')
  })

  it('formats selected labels with unicode words and acronyms intact', () => {
    const card = { teams: [] } as any
    const button = {
      key: 'women-sao-no-ot',
      conditionId: 'women-sao-no-ot',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'WOMEN’S SÃO NO OT',
      cents: 54,
      color: null,
      marketType: 'binary',
      tone: 'neutral',
    } as const

    expect(resolveSelectedTradeLabel(card, button, null)).toBe('Women’s São No OT')
  })

  it('uses title case labels for draw-style order panel selections', () => {
    const card = { teams: [] } as any
    const drawButton = {
      key: 'draw',
      conditionId: 'draw',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'DRAW',
      cents: 32,
      color: null,
      marketType: 'moneyline',
      tone: 'draw',
    } as const
    const neitherButton = {
      ...drawButton,
      key: 'neither',
      conditionId: 'neither',
      label: 'Neither',
      marketType: 'binary',
    } as const

    expect(resolveSelectedTradeLabel(card, drawButton, null)).toBe('Draw')
    expect(resolveSelectedTradeLabel(card, neitherButton, null)).toBe('Neither')
  })

  it('uses full team names for selected spread labels', () => {
    const card = {
      teams: [
        { name: 'France', abbreviation: 'FRA' },
        { name: 'Morocco', abbreviation: 'MAR' },
      ],
    } as any
    const spreadButton = {
      key: 'france-spread',
      conditionId: 'match-spread',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'FRA -1.5',
      cents: 48,
      color: null,
      marketType: 'spread',
      tone: 'team1',
    } as const

    expect(resolveSelectedTradeLabel(card, spreadButton, null)).toBe('France -1.5')
  })

  it('preserves provided half suffixes on selected team labels', () => {
    const card = {
      teams: [
        { name: 'France', abbreviation: 'FRA' },
        { name: 'Morocco', abbreviation: 'MAR' },
      ],
    } as any
    const halfButton = {
      key: 'france-first-half',
      conditionId: 'first-half-france',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'FRA 1H',
      cents: 48,
      color: null,
      marketType: 'moneyline',
      tone: 'team1',
    } as const

    expect(resolveSelectedTradeLabel(card, halfButton, null)).toBe('France 1H')
  })

  it('keeps full moneyline headers for soccer draw markets', () => {
    const card = {
      title: 'France vs Morocco',
      event: {
        tags: [{ slug: 'sports' }],
        main_tag: 'sports',
        sports_sport_slug: 'soccer',
        sports_series_slug: 'fifwc',
      },
      teams: [
        { name: 'France', abbreviation: 'FRA' },
        { name: 'Morocco', abbreviation: 'MAR' },
      ],
      buttons: [
        { marketType: 'moneyline', tone: 'team1' },
        { marketType: 'moneyline', tone: 'draw' },
        { marketType: 'moneyline', tone: 'team2' },
      ],
    } as any
    const selectedButton = {
      label: 'FRA',
    } as any

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: null,
      marketType: 'moneyline',
    })).toBe('France vs Morocco')
  })

  it('uses halftime market names for moneyline order panel headers', () => {
    const card = {
      title: 'France vs Morocco',
      event: {
        tags: [{ slug: 'sports' }],
        main_tag: 'sports',
        sports_sport_slug: 'soccer',
        sports_series_slug: 'fifwc',
      },
      teams: [
        { name: 'France', abbreviation: 'FRA' },
        { name: 'Morocco', abbreviation: 'MAR' },
      ],
    } as any
    const selectedButton = {
      label: 'FRA',
    } as any

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: {
        sports_market_type: 'Halftime Result',
        sports_group_item_title: 'France',
        short_title: 'France',
        title: 'France',
      } as any,
      marketType: 'moneyline',
    })).toBe('Halftime Result')

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: {
        sports_market_type: 'First Half Result',
        sports_group_item_title: 'France',
        short_title: 'France',
        title: 'France',
      } as any,
      marketType: 'moneyline',
    })).toBe('First Half Result')

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: {
        sports_market_type: '1H Result',
        sports_group_item_title: 'France',
        short_title: 'France',
        title: 'France',
      } as any,
      marketType: 'moneyline',
    })).toBe('First Half Result')

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: {
        sports_market_type: 'Second Half Result',
        sports_group_item_title: 'Morocco',
        short_title: 'Morocco',
        title: 'Morocco',
      } as any,
      marketType: 'moneyline',
    })).toBe('Second Half Result')
  })

  it('keeps compact moneyline headers for esports', () => {
    const card = {
      title: 'Team Vitality vs 9z Team',
      event: {
        tags: [{ slug: 'esports' }],
        main_tag: 'esports',
        sports_sport_slug: 'counter-strike',
        sports_series_slug: null,
      },
      teams: [
        { name: 'Team Vitality', abbreviation: 'VIT' },
        { name: '9z Team', abbreviation: '9Z' },
      ],
      buttons: [
        { marketType: 'moneyline', tone: 'team1' },
        { marketType: 'moneyline', tone: 'team2' },
      ],
    } as any
    const selectedButton = {
      label: 'VIT',
    } as any

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket: null,
      marketType: 'moneyline',
    })).toBe('VIT vs 9Z')
  })

  it('uses team total descriptors for order panel headers', () => {
    const card = {
      title: 'France vs Morocco',
      event: {
        tags: [{ slug: 'sports' }],
        main_tag: 'sports',
        sports_sport_slug: 'soccer',
        sports_series_slug: 'fifwc',
      },
      teams: [
        { name: 'France', abbreviation: 'FRA' },
        { name: 'Morocco', abbreviation: 'MAR' },
      ],
    } as any
    const selectedButton = {
      label: 'O 3.5',
    } as any
    const selectedMarket = {
      sports_market_type: 'Team Total Corners',
      sports_group_item_title: 'Morocco Corners: O/U 3.5',
      short_title: 'Team Total Corners',
      title: 'Team Total Corners',
    } as any

    expect(resolveTradeHeaderTitle({
      card,
      selectedButton,
      selectedMarket,
      marketType: 'total',
    })).toBe('Morocco Corners')
  })

  it.each([
    ['ufc_go_the_distance', 'Fight to Go the Distance?'],
    ['ufc_method_of_victory', 'Holloway to win by KO/TKO?'],
  ])('uses the standalone UFC card title for %s order panel headers', (sportsMarketType, title) => {
    const selectedMarket = {
      sports_market_type: sportsMarketType,
      sports_group_item_title: title,
      short_title: title,
      title,
      outcomes: [
        { outcome_index: 0, outcome_text: 'Yes' },
        { outcome_index: 1, outcome_text: 'No' },
      ],
    } as any

    expect(resolveTradeHeaderTitle({
      card: {
        title: 'Holloway vs McGregor',
        event: {
          tags: [{ slug: 'sports' }],
          main_tag: 'sports',
          sports_sport_slug: 'mma',
        },
        teams: [
          { name: 'Max Holloway', abbreviation: 'MAX' },
          { name: 'Conor McGregor', abbreviation: 'CON' },
        ],
      } as any,
      selectedButton: { label: 'YES' } as any,
      selectedMarket,
      marketType: 'binary',
    })).toBe(title)
  })
})
