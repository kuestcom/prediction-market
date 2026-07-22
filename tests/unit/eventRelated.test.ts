import { describe, expect, it } from 'vitest'
import { selectRelatedEventCandidates } from '@/lib/event-related'

function createCandidate({
  id,
  seriesSlug,
  endDate,
  status = 'active',
}: {
  id: string
  seriesSlug?: string
  endDate: string
  status?: 'active' | 'draft'
}) {
  return {
    id,
    slug: id,
    status,
    series_slug: seriesSlug ?? null,
    end_date: endDate,
    created_at: endDate,
    updated_at: endDate,
    markets: [{ is_resolved: false }],
  }
}

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
