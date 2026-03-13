import { buildSportsGamesCardGroups } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'

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
  slug: string
  title: string
  marketType: string
  threshold?: string
}) {
  const { conditionId, slug, title, marketType, threshold = null } = params

  return {
    condition_id: conditionId,
    question_id: `${conditionId}-question`,
    event_id: 'event-1',
    title,
    slug,
    short_title: title,
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 0,
    block_timestamp: '2026-03-13T00:00:00.000Z',
    sports_market_type: marketType,
    sports_group_item_title: title,
    sports_group_item_threshold: threshold,
    volume: 10,
    volume_24h: 0,
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
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
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
    },
  }
}

describe('sportsGamesData', () => {
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

    expect(card?.detailMarkets.map(market => market.slug)).toEqual(expect.arrayContaining([
      'ufc-man15-bol-2026-03-14-go-the-distance',
      'ufc-man15-bol-2026-03-14-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-sousa-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-oki-win-by-ko-tko',
      'ufc-man15-bol-2026-03-14-win-by-submission',
    ]))
  })
})
