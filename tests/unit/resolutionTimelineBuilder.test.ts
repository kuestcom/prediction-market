import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  buildResolutionTimeline,
  formatResolutionCountdown,
  resolveResolutionDeadlineMs,
  shouldDisplayResolutionTimeline,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'

const BASE_TIMESTAMP_ISO = '2026-02-10T00:00:00.000Z'
const BASE_TIMESTAMP_MS = Date.parse(BASE_TIMESTAMP_ISO)

function createMarket(
  overrides: Omit<Partial<Event['markets'][number]>, 'condition'> & {
    condition?: Partial<Event['markets'][number]['condition']>
  } = {},
): Event['markets'][number] {
  const baseCondition: Event['markets'][number]['condition'] = {
    id: 'condition-1',
    oracle: '0x0000000000000000000000000000000000000000',
    question_id: '0xquestion',
    outcome_slot_count: 2,
    resolved: false,
    resolution_status: 'posed',
    resolution_flagged: false,
    resolution_paused: false,
    resolution_last_update: BASE_TIMESTAMP_ISO,
    resolution_price: null,
    resolution_was_disputed: false,
    resolution_approved: null,
    resolution_liveness_seconds: 7200,
    resolution_deadline_at: null,
    volume: 0,
    open_interest: 0,
    active_positions_count: 0,
    created_at: BASE_TIMESTAMP_ISO,
    updated_at: BASE_TIMESTAMP_ISO,
  }

  const baseMarket: Event['markets'][number] = {
    condition_id: 'condition-1',
    question_id: '0xquestion',
    event_id: 'event-1',
    title: 'Market title',
    slug: 'market-title',
    icon_url: '',
    is_active: true,
    is_resolved: false,
    block_number: 0,
    block_timestamp: BASE_TIMESTAMP_ISO,
    metadata: null,
    volume_24h: 0,
    volume: 0,
    created_at: BASE_TIMESTAMP_ISO,
    updated_at: BASE_TIMESTAMP_ISO,
    price: 0.5,
    probability: 50,
    outcomes: [
      {
        condition_id: 'condition-1',
        outcome_text: 'Yes',
        outcome_index: 0,
        token_id: 'yes-token',
        is_winning_outcome: false,
        payout_value: 0,
        created_at: BASE_TIMESTAMP_ISO,
        updated_at: BASE_TIMESTAMP_ISO,
      },
      {
        condition_id: 'condition-1',
        outcome_text: 'No',
        outcome_index: 1,
        token_id: 'no-token',
        is_winning_outcome: false,
        payout_value: 0,
        created_at: BASE_TIMESTAMP_ISO,
        updated_at: BASE_TIMESTAMP_ISO,
      },
    ],
    condition: baseCondition,
  }

  return {
    ...baseMarket,
    ...overrides,
    condition: {
      ...baseCondition,
      ...(overrides.condition ?? {}),
    },
  }
}

describe('resolution timeline builder', () => {
  it('builds resolved no-dispute timeline with final outcome', () => {
    const market = createMarket({
      is_resolved: true,
      condition: {
        resolved: true,
        resolution_status: 'resolved',
        resolution_price: 1,
        resolution_flagged: false,
        resolution_was_disputed: false,
      },
    })

    const timeline = buildResolutionTimeline(market, { nowMs: BASE_TIMESTAMP_MS })

    expect(timeline.items.map(item => item.type)).toEqual([
      'outcomeProposed',
      'noDispute',
      'finalOutcome',
    ])
    expect(timeline.items.find(item => item.type === 'finalOutcome')?.outcome).toBe('yes')
  })

  it('shows disputed step with gavel icon while unresolved', () => {
    const market = createMarket({
      condition: {
        resolution_status: 'challenged',
        resolution_price: 0,
        resolution_was_disputed: true,
      },
    })

    const timeline = buildResolutionTimeline(market, { nowMs: BASE_TIMESTAMP_MS })
    const disputedItem = timeline.items.find(item => item.type === 'disputed')

    expect(timeline.items.map(item => item.type)).toEqual(['outcomeProposed', 'disputed'])
    expect(disputedItem?.icon).toBe('gavel')
    expect(disputedItem?.state).toBe('active')
  })

  it('renders final review with active countdown when flagged and deadline is open', () => {
    const market = createMarket({
      is_resolved: true,
      condition: {
        resolved: true,
        resolution_status: 'resolved',
        resolution_price: 0.5,
        resolution_flagged: true,
        resolution_was_disputed: false,
        resolution_deadline_at: '2026-02-10T01:00:00.000Z',
      },
    })

    const nowMs = Date.parse('2026-02-10T00:30:00.000Z')
    const timeline = buildResolutionTimeline(market, { nowMs })
    const finalReview = timeline.items.find(item => item.type === 'finalReview')

    expect(timeline.items.map(item => item.type)).toEqual([
      'outcomeProposed',
      'noDispute',
      'finalReview',
    ])
    expect(finalReview?.remainingSeconds).toBe(1800)
    expect(formatResolutionCountdown(finalReview?.remainingSeconds ?? 0)).toBe('0h 30m 0s')
  })

  it('uses fallback deadlines from last update + liveness or final-review windows', () => {
    const livenessFallbackMarket = createMarket({
      condition: {
        resolution_status: 'proposed',
        resolution_deadline_at: null,
        resolution_last_update: BASE_TIMESTAMP_ISO,
        resolution_liveness_seconds: 7200,
        resolution_flagged: false,
      },
    })

    const v4FlaggedMarket = createMarket({
      condition: {
        resolution_status: 'resolved',
        resolution_deadline_at: null,
        resolution_last_update: BASE_TIMESTAMP_ISO,
        resolution_liveness_seconds: 7200,
        resolution_flagged: true,
      },
    })

    const negRiskFlaggedMarket = createMarket({
      neg_risk: true,
      condition: {
        resolution_status: 'resolved',
        resolution_deadline_at: null,
        resolution_last_update: BASE_TIMESTAMP_ISO,
        resolution_liveness_seconds: 7200,
        resolution_flagged: true,
      },
    })

    expect(resolveResolutionDeadlineMs(livenessFallbackMarket)).toBe(BASE_TIMESTAMP_MS + 7200 * 1000)
    expect(resolveResolutionDeadlineMs(v4FlaggedMarket)).toBe(BASE_TIMESTAMP_MS + 3600 * 1000)
    expect(resolveResolutionDeadlineMs(negRiskFlaggedMarket)).toBe(BASE_TIMESTAMP_MS + 172800 * 1000)
  })

  it('only displays the timeline after the resolution flow has moved past posed', () => {
    const posedMarket = createMarket({
      condition: {
        resolution_status: 'posed',
      },
    })
    const proposedMarket = createMarket({
      condition: {
        resolution_status: 'proposed',
        resolution_price: 1,
      },
    })

    expect(shouldDisplayResolutionTimeline(posedMarket)).toBe(false)
    expect(shouldDisplayResolutionTimeline(proposedMarket)).toBe(true)
  })
})
