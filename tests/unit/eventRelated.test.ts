import { describe, expect, it } from 'vitest'
import {
  buildRelatedEventPrimaryOutcomes,
  selectCryptoRelatedEventCandidates,
  selectRelatedEventCandidates,
} from '@/lib/event-related'

function createCandidate({
  id,
  seriesSlug,
  title,
  endDate,
  status = 'active',
}: {
  id: string
  seriesSlug?: string
  title?: string
  endDate: string
  status?: 'active' | 'draft'
}) {
  return {
    id,
    slug: id,
    title: title ?? id,
    status,
    series_slug: seriesSlug ?? null,
    end_date: endDate,
    created_at: endDate,
    updated_at: endDate,
    markets: [{ is_resolved: false }],
  }
}

describe('buildRelatedEventPrimaryOutcomes', () => {
  it('uses outcome index 0 for both the related-event price and label', () => {
    const outcomes = buildRelatedEventPrimaryOutcomes([
      {
        event_id: 'bitcoin',
        outcome_index: 1,
        outcome_text: 'Down',
        token_id: 'down-token',
      },
      {
        event_id: 'bitcoin',
        outcome_index: 0,
        outcome_text: 'Up',
        token_id: 'up-token',
      },
    ])

    expect(outcomes.get('bitcoin')).toEqual({
      label: 'Up',
      tokenId: 'up-token',
    })
  })
})

describe('selectRelatedEventCandidates', () => {
  it('keeps the current daily occurrence instead of tomorrow before limiting results', () => {
    const tomorrow = createCandidate({
      id: 'bitcoin-july-24',
      seriesSlug: 'btc-up-or-down-daily',
      endDate: '2026-07-25T16:00:00.000Z',
    })
    const today = createCandidate({
      id: 'bitcoin-july-23',
      seriesSlug: 'btc-up-or-down-daily',
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const ethereum = createCandidate({
      id: 'ethereum-july-23',
      seriesSlug: 'eth-up-or-down-daily',
      endDate: '2026-07-24T16:00:00.000Z',
    })

    const selected = selectRelatedEventCandidates(
      [tomorrow, ethereum, today],
      {
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 3,
      },
    )

    expect(selected.map(event => event.id)).toEqual(['ethereum-july-23', 'bitcoin-july-23'])
  })

  it('excludes sports auxiliary events by parent id even without an auxiliary slug suffix', () => {
    const auxiliary = {
      ...createCandidate({
        id: 'sports-special-market',
        endDate: '2026-07-24T16:00:00.000Z',
      }),
      sports_event_slug: 'sports-special-market',
      sports_parent_event_id: 12345,
      sports_sport_slug: 'soccer',
    }
    const primary = {
      ...createCandidate({
        id: 'sports-primary-market',
        endDate: '2026-07-24T16:00:00.000Z',
      }),
      sports_event_slug: 'sports-primary-market',
      sports_parent_event_id: null,
      sports_sport_slug: 'soccer',
    }

    const selected = selectRelatedEventCandidates(
      [auxiliary, primary],
      {
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 3,
      },
    )

    expect(selected.map(event => event.id)).toEqual(['sports-primary-market'])
  })

  it('excludes drafts before selecting the preferred occurrence for a series', () => {
    const active = createCandidate({
      id: 'bitcoin-active',
      seriesSlug: 'btc-up-or-down-daily',
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const draft = createCandidate({
      id: 'bitcoin-draft',
      seriesSlug: 'btc-up-or-down-daily',
      endDate: '2026-07-23T20:00:00.000Z',
      status: 'draft',
    })
    const standaloneDraft = createCandidate({
      id: 'standalone-draft',
      endDate: '2026-07-24T16:00:00.000Z',
      status: 'draft',
    })

    const selected = selectRelatedEventCandidates(
      [draft, standaloneDraft, active],
      {
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 3,
      },
    )

    expect(selected.map(event => event.id)).toEqual(['bitcoin-active'])
  })
})

describe('selectCryptoRelatedEventCandidates', () => {
  const currentEvent = {
    title: 'Bitcoin Up or Down - July 23',
    end_date: '2026-07-24T16:00:00.000Z',
    series_recurrence: 'daily',
    series_slug: 'btc-up-or-down-daily',
    tags: [{ slug: 'crypto', name: 'Crypto' }],
  }

  it.each([
    ['5M', '5m'],
    ['15M', '15m'],
    ['hourly', 'hourly'],
    ['4hour', '4h'],
    ['daily', 'daily'],
  ])('uses the current coin only across different cadence tabs for %s', (cadenceSlug, seriesCadence) => {
    const bitcoin = createCandidate({
      id: `bitcoin-${seriesCadence}`,
      seriesSlug: `btc-up-or-down-${seriesCadence}`,
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const ethereum = createCandidate({
      id: `ethereum-${seriesCadence}`,
      seriesSlug: `eth-up-or-down-${seriesCadence}`,
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const wrongCadence = createCandidate({
      id: 'solana-weekly',
      seriesSlug: 'sol-up-or-down-weekly',
      endDate: '2026-07-24T16:00:00.000Z',
    })

    const selected = selectCryptoRelatedEventCandidates(
      currentEvent,
      [bitcoin, ethereum, wrongCadence],
      {
        cadenceSlug,
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 3,
      },
    )

    expect(selected.map(event => event.id)).toEqual(
      cadenceSlug === 'daily'
        ? [`ethereum-${seriesCadence}`]
        : [`bitcoin-${seriesCadence}`, `ethereum-${seriesCadence}`],
    )
  })

  it('excludes BTC from the matching 15-minute tab', () => {
    const current15MinuteEvent = {
      ...currentEvent,
      series_recurrence: '15m',
      series_slug: 'btc-up-or-down-15m',
    }
    const bitcoin = createCandidate({
      id: 'bitcoin-15m',
      seriesSlug: 'btc-up-or-down-15m',
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const ethereum = createCandidate({
      id: 'ethereum-15m',
      seriesSlug: 'eth-up-or-down-15m',
      endDate: '2026-07-24T16:00:00.000Z',
    })

    const selected = selectCryptoRelatedEventCandidates(
      current15MinuteEvent,
      [bitcoin, ethereum],
      {
        cadenceSlug: '15M',
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 3,
      },
    )

    expect(selected.map(event => event.id)).toEqual(['ethereum-15m'])
  })

  it('prioritizes the current coin when the related list is limited', () => {
    const ethereum = createCandidate({
      id: 'ethereum-15m',
      seriesSlug: 'eth-up-or-down-15m',
      endDate: '2026-07-24T16:00:00.000Z',
    })
    const bitcoin = createCandidate({
      id: 'bitcoin-15m',
      seriesSlug: 'btc-up-or-down-15m',
      endDate: '2026-07-24T16:00:00.000Z',
    })

    const selected = selectCryptoRelatedEventCandidates(
      currentEvent,
      [ethereum, bitcoin],
      {
        cadenceSlug: '15M',
        currentTimestamp: Date.parse('2026-07-23T18:00:00.000Z'),
        limit: 1,
      },
    )

    expect(selected.map(event => event.id)).toEqual(['bitcoin-15m'])
  })
})
