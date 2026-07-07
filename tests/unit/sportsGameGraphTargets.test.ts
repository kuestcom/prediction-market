import {
  buildMoneylineGraphTargets,
  resolveSportsGraphSelection,
} from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/sports-games-center-utils'
import { buildSportsGamesCardGroups } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'

function buildOutcome(conditionId: string, outcomeIndex: number, outcomeText: string) {
  return {
    condition_id: conditionId,
    outcome_index: outcomeIndex,
    outcome_text: outcomeText,
    token_id: `${conditionId}-${outcomeIndex}`,
    is_winning_outcome: false,
    created_at: '2026-07-06T00:00:00.000Z',
    updated_at: '2026-07-06T00:00:00.000Z',
  }
}

function buildSeparatedMoneylineMarket(conditionId: string, title: string) {
  return {
    condition_id: conditionId,
    question_id: `${conditionId}-question`,
    event_id: 'usa-bel-event',
    title,
    slug: conditionId,
    short_title: title,
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 0,
    block_timestamp: '2026-07-06T00:00:00.000Z',
    sports_market_type: 'moneyline',
    sports_group_item_title: title,
    sports_group_item_threshold: '0',
    volume: 10,
    volume_24h: 0,
    created_at: '2026-07-06T00:00:00.000Z',
    updated_at: '2026-07-06T00:00:00.000Z',
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
      created_at: '2026-07-06T00:00:00.000Z',
      updated_at: '2026-07-06T00:00:00.000Z',
    },
  }
}

describe('sportsGameGraphTargets', () => {
  it('builds separated moneyline graph targets as team draw team, without the No outcome', () => {
    const event = {
      id: 'usa-bel-event',
      slug: 'fifwc-usa-bel-2026-07-06',
      title: 'United States vs Belgium',
      creator: '',
      icon_url: '',
      show_market_icons: true,
      status: 'active',
      sports_event_slug: 'fifwc-usa-bel-2026-07-06',
      sports_sport_slug: 'soccer',
      sports_section: 'games',
      sports_start_time: '2026-07-06T20:00:00.000Z',
      sports_teams: [
        { name: 'United States', abbreviation: 'USA', host_status: 'home' },
        { name: 'Belgium', abbreviation: 'BEL', host_status: 'away' },
      ],
      sports_team_logo_urls: [],
      active_markets_count: 3,
      total_markets_count: 3,
      volume: 0,
      start_date: '2026-07-06T20:00:00.000Z',
      end_date: null,
      created_at: '2026-07-06T00:00:00.000Z',
      updated_at: '2026-07-06T00:00:00.000Z',
      markets: [
        buildSeparatedMoneylineMarket('usa-moneyline', 'United States'),
        buildSeparatedMoneylineMarket('draw-moneyline', 'Draw'),
        buildSeparatedMoneylineMarket('belgium-moneyline', 'Belgium'),
      ],
      tags: [],
      main_tag: 'sports',
      is_bookmarked: false,
      is_trending: false,
    } as any

    const card = buildSportsGamesCardGroups([event])[0]?.primaryCard

    expect(card).toBeDefined()
    const team1ButtonKey = card!.buttons.find(button => button.tone === 'team1')?.key ?? null

    expect(team1ButtonKey).toBeTruthy()
    expect(resolveSportsGraphSelection(card!, team1ButtonKey)).toEqual({
      selectedMarketType: 'moneyline',
      selectedConditionId: null,
    })
    expect(buildMoneylineGraphTargets(card!).map(target => target.name)).toEqual([
      'United States',
      'Draw',
      'Belgium',
    ])
  })
})
