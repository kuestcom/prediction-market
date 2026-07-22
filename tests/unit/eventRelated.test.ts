import { describe, expect, it } from 'vitest'
import { selectRelatedEventCandidates } from '@/lib/event-related'

function createCandidate({
  id,
  seriesSlug,
  endDate,
}: {
  id: string
  seriesSlug?: string
  endDate: string
}) {
  return {
    id,
    slug: id,
    status: 'active' as const,
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
})
