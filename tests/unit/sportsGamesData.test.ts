import { buildSportsGamesCardGroups } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'

function buildOutcome(conditionId: string, outcomeIndex: number, outcomeText: string) {
  return {
    condition_id: conditionId,
    outcome_index: outcomeIndex,
    outcome_text: outcomeText,
    token_id: `${conditionId}-${outcomeIndex}`,
    is_winning_outcome: false,
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
  }
}

function buildBinaryMarket(params: {
  conditionId: string
  eventId?: string
  slug: string
  title: string
  marketType: string
  threshold?: string
  createdAt?: string
  volume?: number
}) {
  const {
    conditionId,
    eventId = 'event-1',
    slug,
    title,
    marketType,
    threshold = null,
    createdAt = '2026-03-13T00:00:00.000Z',
    volume = 10,
  } = params

  return {
    condition_id: conditionId,
    question_id: `${conditionId}-question`,
    event_id: eventId,
    title,
    slug,
    short_title: title,
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 0,
    block_timestamp: createdAt,
    sports_market_type: marketType,
    sports_group_item_title: title,
    sports_group_item_threshold: threshold,
    volume,
    volume_24h: 0,
    created_at: createdAt,
    updated_at: createdAt,
    price: 0.5,
    probability: 50,
    outcomes: [
      buildOutcome(conditionId, 0, 'Yes'),
      buildOutcome(conditionId, 1, 'No'),
    ],
    condition: {
      id: conditionId,
      oracle: '',
      question_id: `${conditionId}-question`,
      outcome_slot_count: 2,
      resolved: false,
      volume: 0,
      open_interest: 0,
      active_positions_count: 0,
      created_at: createdAt,
      updated_at: createdAt,
    },
  }
}

function buildMoneylineMarket(params: {
  eventId: string
  slug: string
  title: string
  outcomes: string[]
  createdAt?: string
  volume?: number
}) {
  const {
    eventId,
    slug,
    title,
    outcomes,
    createdAt = '2026-03-13T00:00:00.000Z',
    volume = 10,
  } = params

  return {
    condition_id: `${eventId}-moneyline`,
    question_id: `${eventId}-moneyline-question`,
    event_id: eventId,
    title,
    slug,
    short_title: title,
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 0,
    block_timestamp: createdAt,
    sports_market_type: 'moneyline',
    sports_group_item_title: title,
    sports_group_item_threshold: '0',
    volume,
    volume_24h: 0,
    created_at: createdAt,
    updated_at: createdAt,
    price: 0.5,
    probability: 50,
    outcomes: outcomes.map((outcome, outcomeIndex) =>
      buildOutcome(`${eventId}-moneyline`, outcomeIndex, outcome),
    ),
    condition: {
      id: `${eventId}-moneyline`,
      oracle: '',
      question_id: `${eventId}-moneyline-question`,
      outcome_slot_count: outcomes.length,
      resolved: false,
      volume: 0,
      open_interest: 0,
      active_positions_count: 0,
      created_at: createdAt,
      updated_at: createdAt,
    },
  }
}

function buildSportsEvent(params: {
  id: string
  slug: string
  title: string
  markets: Array<Record<string, unknown>>
  createdAt?: string
  sportsStartTime?: string | null
  sportsTeams?: Array<Record<string, unknown>>
  sportsTeamLogoUrls?: string[]
  sportsEventId?: string | null
  sportsParentEventId?: number | null
}) {
  const {
    id,
    slug,
    title,
    markets,
    createdAt = '2026-03-13T00:00:00.000Z',
    sportsStartTime = '2026-03-21T09:00:00.000Z',
    sportsTeams = [],
    sportsTeamLogoUrls = [],
    sportsEventId = null,
    sportsParentEventId = null,
  } = params

  return {
    id,
    slug,
    title,
    creator: '',
    icon_url: '',
    show_market_icons: true,
    status: 'active',
    sports_event_slug: slug,
    sports_sport_slug: 'international',
    sports_section: 'games',
    sports_start_time: sportsStartTime,
    sports_teams: sportsTeams,
    sports_team_logo_urls: sportsTeamLogoUrls,
    sports_event_id: sportsEventId,
    sports_parent_event_id: sportsParentEventId,
    active_markets_count: markets.length,
    total_markets_count: markets.length,
    volume: 0,
    start_date: sportsStartTime,
    end_date: null,
    created_at: createdAt,
    updated_at: createdAt,
    markets,
    tags: [],
    main_tag: 'sports',
    is_bookmarked: false,
    is_trending: false,
  } as any
}

describe('sportsGamesData', () => {
  it('keeps CS2 child moneyline markets out of the primary moneyline buttons', () => {
    const event = buildSportsEvent({
      id: 'cs2-event',
      slug: 'cs2-vit-9z-2026-03-19',
      title: 'Counter-Strike: Vitality vs 9z (BO3)',
      sportsTeams: [
        { name: 'Vitality', abbreviation: 'VIT', host_status: 'home' },
        { name: '9z', abbreviation: '9Z', host_status: 'away' },
      ],
      markets: [
        {
          ...buildMoneylineMarket({
            eventId: 'cs2-event',
            slug: 'cs2-vit-9z-2026-03-19',
            title: 'Match Winner',
            outcomes: ['Vitality', '9z'],
          }),
          condition_id: 'match-winner',
          question_id: 'match-winner-question',
          outcomes: [
            buildOutcome('match-winner', 0, 'Vitality'),
            buildOutcome('match-winner', 1, '9z'),
          ],
        },
        {
          ...buildBinaryMarket({
            conditionId: 'map-1-winner',
            eventId: 'cs2-event',
            slug: 'cs2-vit-9z-2026-03-19-game1',
            title: 'Map 1 Winner',
            marketType: 'child_moneyline',
          }),
          outcomes: [
            buildOutcome('map-1-winner', 0, 'Vitality'),
            buildOutcome('map-1-winner', 1, '9z'),
          ],
        },
        {
          ...buildBinaryMarket({
            conditionId: 'map-2-winner',
            eventId: 'cs2-event',
            slug: 'cs2-vit-9z-2026-03-19-game2',
            title: 'Map 2 Winner',
            marketType: 'child_moneyline',
          }),
          outcomes: [
            buildOutcome('map-2-winner', 0, 'Vitality'),
            buildOutcome('map-2-winner', 1, '9z'),
          ],
        },
        buildBinaryMarket({
          conditionId: 'map-handicap',
          eventId: 'cs2-event',
          slug: 'cs2-vit-9z-2026-03-19-map-handicap-away-1pt5',
          title: 'Map Handicap: VIT (-1.5) vs 9z (+1.5)',
          marketType: 'map_handicap',
        }),
        buildBinaryMarket({
          conditionId: 'total-maps',
          eventId: 'cs2-event',
          slug: 'cs2-vit-9z-2026-03-19-total-games-2pt5',
          title: 'O/U 2.5 Games',
          marketType: 'totals',
        }),
        buildBinaryMarket({
          conditionId: 'map-1-kills',
          eventId: 'cs2-event',
          slug: 'cs2-vit-9z-2026-03-19-game1-odd-even-total-kills',
          title: 'Odd/Even Total Kills',
          marketType: 'cs2_odd_even_total_kills',
        }),
      ],
    })

    const group = buildSportsGamesCardGroups([event])[0]
    expect(group).toBeDefined()

    const moneylineButtons = group!.primaryCard.buttons.filter(button => button.marketType === 'moneyline')
    expect(moneylineButtons).toHaveLength(2)
    expect(new Set(moneylineButtons.map(button => button.conditionId))).toEqual(new Set(['match-winner']))

    const childMoneylineButtons = group!.primaryCard.buttons.filter(button =>
      button.conditionId === 'map-1-winner' || button.conditionId === 'map-2-winner',
    )
    expect(childMoneylineButtons).toHaveLength(4)
    expect(childMoneylineButtons.every(button => button.marketType === 'binary')).toBe(true)
  })

  it('uses the market game start time when the event start time is missing', () => {
    const event = {
      id: 'event-start-fallback',
      slug: 'euroleague-barcelon-efes-2026-03-24',
      title: 'Barcelona vs. Anadolu Efes',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'euroleague-barcelon-efes-2026-03-24',
      sports_sport_slug: 'euroleague',
      sports_section: 'games',
      sports_start_time: null,
      sports_teams: [
        { name: 'Barcelona', abbreviation: 'BAR', host_status: 'home' },
        { name: 'Anadolu Efes', abbreviation: 'EFS', host_status: 'away' },
      ],
      active_markets_count: 1,
      total_markets_count: 1,
      volume: 0,
      start_date: null,
      end_date: null,
      created_at: '2026-03-18T14:02:52.748Z',
      updated_at: '2026-03-18T14:02:52.748Z',
      markets: [
        {
          condition_id: 'moneyline',
          question_id: 'moneyline-question',
          event_id: 'event-start-fallback',
          title: 'Barcelona vs. Anadolu Efes',
          slug: 'euroleague-barcelon-efes-2026-03-24',
          short_title: 'Barcelona vs. Anadolu Efes',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-18T14:02:52.748Z',
          sports_market_type: 'moneyline',
          sports_game_start_time: '2026-03-24T19:30:00.000Z',
          sports_group_item_title: 'Barcelona vs. Anadolu Efes',
          sports_group_item_threshold: '0',
          volume: 5,
          volume_24h: 0,
          created_at: '2026-03-18T14:02:52.748Z',
          updated_at: '2026-03-18T14:02:52.748Z',
          price: 0.5,
          probability: 50,
          outcomes: [
            buildOutcome('moneyline', 0, 'Barcelona'),
            buildOutcome('moneyline', 1, 'Anadolu Efes'),
          ],
          condition: {
            id: 'moneyline',
            oracle: '',
            question_id: 'moneyline-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-18T14:02:52.748Z',
            updated_at: '2026-03-18T14:02:52.748Z',
          },
        },
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const groups = buildSportsGamesCardGroups([event])

    expect(groups[0]?.primaryCard.startTime).toBe('2026-03-24T19:30:00.000Z')
  })

  it('groups cricket auxiliary events under the base event and keeps draw out of moneyline', () => {
    const baseSlug = 'crint-nga-zwe-2026-03-21'
    const baseEventId = 'cricket-base-event'
    const auxiliaryEventId = 'cricket-team-top-batter-event'
    const zimbabweLogoUrl = 'https://example.com/zwe.png'

    const groupedEvents = buildSportsGamesCardGroups([
      buildSportsEvent({
        id: auxiliaryEventId,
        slug: `${baseSlug}-team-top-batter`,
        title: 'T20 Nigeria Invitational Tournament, Women: Nigeria vs Zimbabwe - Team Top Batter',
        createdAt: '2026-03-13T00:00:00.000Z',
        sportsParentEventId: 283440,
        markets: [
          buildBinaryMarket({
            eventId: auxiliaryEventId,
            conditionId: 'team-top-batter-nga',
            slug: `${baseSlug}-team-top-batter-nga`,
            title: 'NGA',
            marketType: 'cricket_team_top_batter',
            threshold: '0',
          }),
          buildBinaryMarket({
            eventId: auxiliaryEventId,
            conditionId: 'team-top-batter-draw',
            slug: `${baseSlug}-team-top-batter-draw`,
            title: 'Draw',
            marketType: 'cricket_team_top_batter',
            threshold: '1',
          }),
          buildBinaryMarket({
            eventId: auxiliaryEventId,
            conditionId: 'team-top-batter-zwe',
            slug: `${baseSlug}-team-top-batter-zwe`,
            title: 'ZWE',
            marketType: 'cricket_team_top_batter',
            threshold: '2',
          }),
        ],
      }),
      buildSportsEvent({
        id: baseEventId,
        slug: baseSlug,
        title: 'T20 Nigeria Invitational Tournament, Women: Nigeria vs Zimbabwe',
        createdAt: '2026-03-18T00:00:00.000Z',
        sportsEventId: '283440',
        sportsTeams: [
          { name: 'Nigeria', abbreviation: 'NGA', host_status: 'home' },
          {
            name: 'Zimbabwe',
            abbreviation: 'ZWE',
            host_status: 'away',
            color: '#c5291c',
            logo_url: zimbabweLogoUrl,
          },
        ],
        sportsTeamLogoUrls: [zimbabweLogoUrl],
        markets: [
          buildMoneylineMarket({
            eventId: baseEventId,
            slug: baseSlug,
            title: 'Nigeria vs Zimbabwe',
            outcomes: ['Nigeria', 'Zimbabwe'],
          }),
        ],
      }),
    ])

    expect(groupedEvents).toHaveLength(1)

    const card = groupedEvents[0]?.primaryCard
    const moneylineButtons = card?.buttons.filter(button => button.marketType === 'moneyline') ?? []
    const binaryButtons = card?.buttons.filter(button => button.marketType === 'binary') ?? []

    expect(card?.slug).toBe(baseSlug)
    expect(card?.teams.map(team => team.name)).toEqual(['Nigeria', 'Zimbabwe'])
    expect(card?.teams.map(team => team.logoUrl)).toEqual([null, zimbabweLogoUrl])
    expect(moneylineButtons.map(button => button.label)).toEqual(['NGA', 'ZWE'])
    expect(moneylineButtons.some(button => button.label === 'DRAW')).toBe(false)
    expect(binaryButtons.map(button => button.label)).toEqual(['NGA', 'DRAW', 'ZWE'])
  })

  it('does not use indexed team logo fallback when unnamed teams make the logo array ambiguous', () => {
    const nigeriaLogoUrl = 'https://example.com/nigeria.png'
    const zimbabweLogoUrl = 'https://example.com/zimbabwe.png'
    const event = buildSportsEvent({
      id: 'cricket-logo-alignment',
      slug: 'crint-nga-zwe-2026-03-21',
      title: 'Nigeria vs Zimbabwe',
      sportsTeams: [
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
      sportsTeamLogoUrls: [nigeriaLogoUrl, zimbabweLogoUrl],
      markets: [
        buildMoneylineMarket({
          eventId: 'cricket-logo-alignment',
          slug: 'crint-nga-zwe-2026-03-21',
          title: 'Nigeria vs Zimbabwe',
          outcomes: ['Nigeria', 'Zimbabwe'],
        }),
      ],
    })

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard

    expect(card?.teams.map(team => team.logoUrl)).toEqual([null, null])
  })

  it('uses indexed team logo fallback when the raw sports team list is fully named and positional', () => {
    const nigeriaLogoUrl = 'https://example.com/nigeria.png'
    const zimbabweLogoUrl = 'https://example.com/zimbabwe.png'
    const event = buildSportsEvent({
      id: 'cricket-logo-positional-fallback',
      slug: 'crint-nga-zwe-2026-03-21',
      title: 'Nigeria vs Zimbabwe',
      sportsTeams: [
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
      sportsTeamLogoUrls: [nigeriaLogoUrl, zimbabweLogoUrl],
      markets: [
        buildMoneylineMarket({
          eventId: 'cricket-logo-positional-fallback',
          slug: 'crint-nga-zwe-2026-03-21',
          title: 'Nigeria vs Zimbabwe',
          outcomes: ['Nigeria', 'Zimbabwe'],
        }),
      ],
    })

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard

    expect(card?.teams.map(team => team.logoUrl)).toEqual([nigeriaLogoUrl, zimbabweLogoUrl])
  })

  it('keeps UFC binary proposition markets out of the moneyline buttons and preserves them as detail markets', () => {
    const event = {
      id: 'event-1',
      slug: 'ufc-man15-bol-2026-03-14',
      title: 'UFC Fight Night: Manoel Sousa vs. Bolaji Oki',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'ufc-man15-bol-2026-03-14',
      sports_sport_slug: 'mma',
      sports_section: 'games',
      sports_start_time: '2026-03-14T00:00:00.000Z',
      sports_teams: [
        { name: 'Manoel Sousa', abbreviation: 'MAN15', host_status: 'home' },
        { name: 'Bolaji Oki', abbreviation: 'BOL', host_status: 'away' },
      ],
      active_markets_count: 9,
      total_markets_count: 9,
      volume: 0,
      start_date: '2026-03-14T00:00:00.000Z',
      end_date: null,
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
      markets: [
        {
          condition_id: 'moneyline',
          question_id: 'moneyline-question',
          event_id: 'event-1',
          title: 'Manoel Sousa vs. Bolaji Oki',
          slug: 'ufc-man15-bol-2026-03-14',
          short_title: 'Manoel Sousa vs. Bolaji Oki',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: 'moneyline',
          sports_group_item_title: 'Manoel Sousa vs. Bolaji Oki',
          sports_group_item_threshold: '0',
          volume: 5,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.5,
          probability: 50,
          outcomes: [
            buildOutcome('moneyline', 0, 'Manoel Sousa'),
            buildOutcome('moneyline', 1, 'Bolaji Oki'),
          ],
          condition: {
            id: 'moneyline',
            oracle: '',
            question_id: 'moneyline-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        {
          condition_id: 'totals-0pt5',
          question_id: 'totals-0pt5-question',
          event_id: 'event-1',
          title: 'O/U 0.5 Rounds',
          slug: 'ufc-man15-bol-2026-03-14-totals-0pt5',
          short_title: 'O/U 0.5 Rounds',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: 'totals',
          sports_group_item_title: 'O/U 0.5 Rounds',
          sports_group_item_threshold: '6',
          volume: 64,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.5,
          probability: 50,
          outcomes: [
            buildOutcome('totals-0pt5', 0, 'Over'),
            buildOutcome('totals-0pt5', 1, 'Under'),
          ],
          condition: {
            id: 'totals-0pt5',
            oracle: '',
            question_id: 'totals-0pt5-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        buildBinaryMarket({
          conditionId: 'go-distance',
          slug: 'ufc-man15-bol-2026-03-14-go-the-distance',
          title: 'Fight to Go the Distance?',
          marketType: 'ufc_go_the_distance',
          threshold: '1',
        }),
        buildBinaryMarket({
          conditionId: 'fight-ko',
          slug: 'ufc-man15-bol-2026-03-14-win-by-ko-tko',
          title: 'Fight won by KO/TKO?',
          marketType: 'ufc_method_of_victory',
          threshold: '2',
        }),
        buildBinaryMarket({
          conditionId: 'sousa-ko',
          slug: 'ufc-man15-bol-2026-03-14-sousa-win-by-ko-tko',
          title: 'Sousa to win by KO/TKO?',
          marketType: 'ufc_method_of_victory',
          threshold: '3',
        }),
        buildBinaryMarket({
          conditionId: 'oki-ko',
          slug: 'ufc-man15-bol-2026-03-14-oki-win-by-ko-tko',
          title: 'Oki to win by KO/TKO?',
          marketType: 'ufc_method_of_victory',
          threshold: '4',
        }),
        buildBinaryMarket({
          conditionId: 'submission',
          slug: 'ufc-man15-bol-2026-03-14-win-by-submission',
          title: 'Fight won by submission?',
          marketType: 'ufc_method_of_victory',
          threshold: '5',
        }),
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard

    expect(card).toBeTruthy()
    expect(card?.buttons.filter(button => button.marketType === 'moneyline').map(button => button.label)).toEqual([
      'MAN15',
      'BOL',
    ])

    const binaryConditionIds = Array.from(new Set(
      card?.buttons.filter(button => button.marketType === 'binary').map(button => button.conditionId),
    ))
    expect(binaryConditionIds).toHaveLength(5)

    expect(
      card?.detailMarkets
        .filter(market => binaryConditionIds.includes(market.condition_id))
        .map(market => market.slug)
        .sort(),
    ).toEqual([
      'ufc-man15-bol-2026-03-14-go-the-distance',
      'ufc-man15-bol-2026-03-14-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-sousa-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-oki-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-win-by-submission',
    ].sort())
  })

  it('classifies yes/no props with totals-style metadata as binary markets', () => {
    const event = {
      id: 'event-2',
      slug: 'ufc-over-prop',
      title: 'UFC Fight Night: Over Prop',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'ufc-over-prop',
      sports_sport_slug: 'mma',
      sports_section: 'games',
      sports_start_time: '2026-03-14T00:00:00.000Z',
      sports_teams: [
        { name: 'Manoel Sousa', abbreviation: 'MAN15', host_status: 'home' },
        { name: 'Bolaji Oki', abbreviation: 'BOL', host_status: 'away' },
      ],
      active_markets_count: 2,
      total_markets_count: 2,
      volume: 0,
      start_date: '2026-03-14T00:00:00.000Z',
      end_date: null,
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
      markets: [
        {
          condition_id: 'moneyline',
          question_id: 'moneyline-question',
          event_id: 'event-2',
          title: 'Manoel Sousa vs. Bolaji Oki',
          slug: 'ufc-over-prop-moneyline',
          short_title: 'Manoel Sousa vs. Bolaji Oki',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: 'moneyline',
          sports_group_item_title: 'Manoel Sousa vs. Bolaji Oki',
          sports_group_item_threshold: '0',
          volume: 5,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.5,
          probability: 50,
          outcomes: [
            buildOutcome('moneyline', 0, 'Manoel Sousa'),
            buildOutcome('moneyline', 1, 'Bolaji Oki'),
          ],
          condition: {
            id: 'moneyline',
            oracle: '',
            question_id: 'moneyline-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        buildBinaryMarket({
          conditionId: 'over-prop',
          slug: 'ufc-over-prop-over-1pt5-rounds',
          title: 'Over 1.5 Rounds?',
          marketType: 'totals',
          threshold: '1',
        }),
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard
    const binaryButtons = card?.buttons.filter(button => button.conditionId === 'over-prop') ?? []

    expect(binaryButtons).toHaveLength(2)
    expect(Array.from(new Set(binaryButtons.map(button => button.marketType)))).toEqual(['binary'])
    expect(binaryButtons.map(button => button.label)).toEqual(['YES', 'NO'])
  })

  it('keeps separated team markets in moneyline when only draw is explicitly typed', () => {
    const event = {
      id: 'event-3',
      slug: 'ars-che-draw-split',
      title: 'Arsenal vs. Chelsea',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'ars-che-draw-split',
      sports_sport_slug: 'soccer',
      sports_section: 'games',
      sports_start_time: '2026-03-14T00:00:00.000Z',
      sports_teams: [
        { name: 'Arsenal', abbreviation: 'ARS', host_status: 'home' },
        { name: 'Chelsea', abbreviation: 'CHE', host_status: 'away' },
      ],
      active_markets_count: 3,
      total_markets_count: 3,
      volume: 0,
      start_date: '2026-03-14T00:00:00.000Z',
      end_date: null,
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
      markets: [
        {
          condition_id: 'arsenal-market',
          question_id: 'arsenal-market-question',
          event_id: 'event-3',
          title: 'Arsenal',
          slug: 'ars-che-home',
          short_title: 'Arsenal',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: null,
          sports_group_item_title: 'Arsenal',
          sports_group_item_threshold: '0',
          volume: 10,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.61,
          probability: 61,
          outcomes: [
            buildOutcome('arsenal-market', 0, 'Yes'),
            buildOutcome('arsenal-market', 1, 'No'),
          ],
          condition: {
            id: 'arsenal-market',
            oracle: '',
            question_id: 'arsenal-market-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        {
          condition_id: 'draw-market',
          question_id: 'draw-market-question',
          event_id: 'event-3',
          title: 'Draw',
          slug: 'ars-che-draw',
          short_title: 'Draw',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: 'moneyline',
          sports_group_item_title: 'Draw',
          sports_group_item_threshold: '1',
          volume: 10,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.19,
          probability: 19,
          outcomes: [
            buildOutcome('draw-market', 0, 'Yes'),
            buildOutcome('draw-market', 1, 'No'),
          ],
          condition: {
            id: 'draw-market',
            oracle: '',
            question_id: 'draw-market-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        {
          condition_id: 'chelsea-market',
          question_id: 'chelsea-market-question',
          event_id: 'event-3',
          title: 'Chelsea',
          slug: 'ars-che-away',
          short_title: 'Chelsea',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: null,
          sports_group_item_title: 'Chelsea',
          sports_group_item_threshold: '2',
          volume: 10,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.27,
          probability: 27,
          outcomes: [
            buildOutcome('chelsea-market', 0, 'Yes'),
            buildOutcome('chelsea-market', 1, 'No'),
          ],
          condition: {
            id: 'chelsea-market',
            oracle: '',
            question_id: 'chelsea-market-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard
    const moneylineButtons = card?.buttons.filter(button => button.marketType === 'moneyline') ?? []

    expect(moneylineButtons.map(button => button.label)).toEqual(['ARS', 'DRAW', 'CHE'])
    expect(moneylineButtons.map(button => button.conditionId)).toEqual([
      'arsenal-market',
      'draw-market',
      'chelsea-market',
    ])
    expect(moneylineButtons.map(button => button.cents)).toEqual([61, 19, 27])
    expect(card?.buttons.filter(button => button.marketType === 'binary')).toHaveLength(0)
  })

  it('keeps separated moneyline yes buttons correct when yes is stored at outcome index 1', () => {
    const event = {
      id: 'event-4',
      slug: 'ars-che-split-reversed',
      title: 'Arsenal vs. Chelsea',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'ars-che-split-reversed',
      sports_sport_slug: 'soccer',
      sports_section: 'games',
      sports_start_time: '2026-03-14T00:00:00.000Z',
      sports_teams: [
        { name: 'Arsenal', abbreviation: 'ARS', host_status: 'home' },
        { name: 'Chelsea', abbreviation: 'CHE', host_status: 'away' },
      ],
      active_markets_count: 2,
      total_markets_count: 2,
      volume: 0,
      start_date: '2026-03-14T00:00:00.000Z',
      end_date: null,
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
      markets: [
        {
          condition_id: 'arsenal-market',
          question_id: 'arsenal-market-question',
          event_id: 'event-4',
          title: 'Arsenal',
          slug: 'ars-che-home',
          short_title: 'Arsenal',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: null,
          sports_group_item_title: 'Arsenal',
          sports_group_item_threshold: '0',
          volume: 10,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.61,
          probability: 61,
          outcomes: [
            buildOutcome('arsenal-market', 0, 'No'),
            buildOutcome('arsenal-market', 1, 'Yes'),
          ],
          condition: {
            id: 'arsenal-market',
            oracle: '',
            question_id: 'arsenal-market-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
        {
          condition_id: 'chelsea-market',
          question_id: 'chelsea-market-question',
          event_id: 'event-4',
          title: 'Chelsea',
          slug: 'ars-che-away',
          short_title: 'Chelsea',
          icon_url: '',
          is_active: true,
          is_resolved: false,
          block_number: 0,
          block_timestamp: '2026-03-13T00:00:00.000Z',
          sports_market_type: null,
          sports_group_item_title: 'Chelsea',
          sports_group_item_threshold: '1',
          volume: 10,
          volume_24h: 0,
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-13T00:00:00.000Z',
          price: 0.27,
          probability: 27,
          outcomes: [
            buildOutcome('chelsea-market', 0, 'No'),
            buildOutcome('chelsea-market', 1, 'Yes'),
          ],
          condition: {
            id: 'chelsea-market',
            oracle: '',
            question_id: 'chelsea-market-question',
            outcome_slot_count: 2,
            resolved: false,
            volume: 0,
            open_interest: 0,
            active_positions_count: 0,
            created_at: '2026-03-13T00:00:00.000Z',
            updated_at: '2026-03-13T00:00:00.000Z',
          },
        },
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const groups = buildSportsGamesCardGroups([event])
    const card = groups[0]?.primaryCard
    const moneylineButtons = card?.buttons.filter(button => button.marketType === 'moneyline') ?? []

    expect(moneylineButtons).toHaveLength(2)
    expect(moneylineButtons.map(button => `${button.conditionId}:${button.outcomeIndex}`)).toEqual([
      'arsenal-market:1',
      'chelsea-market:1',
    ])
    expect(moneylineButtons.map(button => button.label)).toEqual(['ARS', 'CHE'])
    expect(moneylineButtons.map(button => button.cents)).toEqual([61, 27])
  })

  it('builds a dedicated goalscorers market view and keeps goal scorer cards separated', () => {
    const event = buildSportsEvent({
      id: 'soccer-goalscorers',
      slug: 'la-inter-2026-04-01-custom-markets',
      title: 'LA Galaxy vs Inter Miami',
      sportsTeams: [
        { name: 'LA Galaxy', abbreviation: 'LAG', host_status: 'home' },
        { name: 'Inter Miami', abbreviation: 'MIA', host_status: 'away' },
      ],
      markets: [
        buildMoneylineMarket({
          eventId: 'soccer-goalscorers',
          slug: 'la-inter-2026-04-01',
          title: 'LA Galaxy vs Inter Miami',
          outcomes: ['LA Galaxy', 'Inter Miami'],
        }),
        buildBinaryMarket({
          conditionId: 'goalscorer-messi',
          eventId: 'soccer-goalscorers',
          slug: 'messi-anytime-goalscorer',
          title: 'Lionel Messi Anytime Goalscorer',
          marketType: 'soccer_anytime_goalscorer',
        }),
        buildBinaryMarket({
          conditionId: 'goalscorer-suarez',
          eventId: 'soccer-goalscorers',
          slug: 'suarez-anytime-goalscorer',
          title: 'Luis Suarez Anytime Goalscorer',
          marketType: 'soccer_anytime_goalscorer',
        }),
      ],
    })

    const group = buildSportsGamesCardGroups([event])[0]
    expect(group).toBeDefined()

    expect(group?.marketViewCards.map(view => view.key)).toEqual(['gameLines', 'goalscorers'])
    expect(group?.marketViewCards.find(view => view.key === 'gameLines')?.card.buttons.map(button => button.marketType)).toEqual([
      'moneyline',
      'moneyline',
    ])

    const goalscorersView = group?.marketViewCards.find(view => view.key === 'goalscorers')?.card ?? null
    expect(goalscorersView?.detailMarkets.map(market => market.condition_id)).toEqual([
      'goalscorer-messi',
      'goalscorer-suarez',
    ])
    expect(goalscorersView?.buttons.map(button => `${button.conditionId}:${button.label}`)).toEqual([
      'goalscorer-messi:YES',
      'goalscorer-messi:NO',
      'goalscorer-suarez:YES',
      'goalscorer-suarez:NO',
    ])
  })
})
