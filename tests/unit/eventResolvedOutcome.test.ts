import { describe, expect, it } from 'vitest'
import {
  resolveEventResolvedOutcomeIndex,
  toResolutionTimelineOutcome,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventResolvedOutcome'
import { OUTCOME_INDEX } from '@/lib/constants'

describe('eventResolvedOutcome', () => {
  it('marks partially resolved numeric ladder markets as No while the event is still active', () => {
    const event = {
      status: 'active',
      resolved_at: null,
      sports_score: null,
      sports_teams: null,
      markets: [
        {
          condition_id: '26c',
          short_title: '26°C',
          title: 'Will the highest temperature in Sao Paulo be 26°C on March 24?',
          slug: 'highest-temperature-in-sao-paulo-on-march-24-2026-26c',
          sports_market_type: null,
          sports_group_item_title: null,
          is_resolved: true,
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes', is_winning_outcome: false },
            { outcome_index: 1, outcome_text: 'No', is_winning_outcome: false },
          ],
          condition: {
            resolved: true,
            resolution_price: null,
          },
        },
        {
          condition_id: '27c',
          short_title: '27°C',
          title: 'Will the highest temperature in Sao Paulo be 27°C on March 24?',
          slug: 'highest-temperature-in-sao-paulo-on-march-24-2026-27c',
          sports_market_type: null,
          sports_group_item_title: null,
          is_resolved: false,
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes', is_winning_outcome: false },
            { outcome_index: 1, outcome_text: 'No', is_winning_outcome: false },
          ],
          condition: {
            resolved: false,
            resolution_price: null,
          },
        },
      ],
    } as any

    const resolvedOutcomeIndex = resolveEventResolvedOutcomeIndex(event, event.markets[0])

    expect(resolvedOutcomeIndex).toBe(OUTCOME_INDEX.NO)
    expect(toResolutionTimelineOutcome(resolvedOutcomeIndex)).toBe('no')
  })

  it('falls back to the sports score for separated moneyline markets', () => {
    const event = {
      status: 'resolved',
      resolved_at: '2026-02-27T12:41:18.722Z',
      sports_score: '2 - 1',
      sports_teams: [
        {
          name: 'Santos FC',
          abbreviation: 'SAN',
          host_status: 'home',
        },
        {
          name: 'CR Vasco da Gama',
          abbreviation: 'VAS',
          host_status: 'away',
        },
      ],
      markets: [
        {
          condition_id: 'santos-market',
          short_title: 'Santos FC',
          title: 'Will Santos FC win on 2026-02-26?',
          slug: 'bra-san-vas-2026-02-26-san',
          sports_market_type: 'moneyline',
          sports_group_item_title: 'Santos FC',
          is_resolved: true,
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes', is_winning_outcome: false },
            { outcome_index: 1, outcome_text: 'No', is_winning_outcome: false },
          ],
          condition: {
            resolved: true,
            resolution_price: null,
          },
        },
        {
          condition_id: 'vasco-market',
          short_title: 'CR Vasco da Gama',
          title: 'Will CR Vasco da Gama win on 2026-02-26?',
          slug: 'bra-san-vas-2026-02-26-vas',
          sports_market_type: 'moneyline',
          sports_group_item_title: 'CR Vasco da Gama',
          is_resolved: true,
          outcomes: [
            { outcome_index: 0, outcome_text: 'Yes', is_winning_outcome: false },
            { outcome_index: 1, outcome_text: 'No', is_winning_outcome: false },
          ],
          condition: {
            resolved: true,
            resolution_price: null,
          },
        },
      ],
    } as any

    expect(resolveEventResolvedOutcomeIndex(event, event.markets[0])).toBe(OUTCOME_INDEX.YES)
    expect(resolveEventResolvedOutcomeIndex(event, event.markets[1])).toBe(OUTCOME_INDEX.NO)
  })
})
