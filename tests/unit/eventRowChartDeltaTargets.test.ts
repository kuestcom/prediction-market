import { describe, expect, it } from 'vitest'
import { buildRowChartDeltaTargets } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventRowChartDeltaTargets'

describe('buildRowChartDeltaTargets', () => {
  it('hydrates chart deltas for every unresolved market', () => {
    const targets = buildRowChartDeltaTargets([
      {
        condition_id: 'market-open-1',
        is_resolved: false,
        outcomes: [
          { outcome_index: 0, token_id: 'yes-1' },
          { outcome_index: 1, token_id: 'no-1' },
        ],
      },
      {
        condition_id: 'market-resolved',
        is_resolved: true,
        outcomes: [
          { outcome_index: 0, token_id: 'yes-resolved' },
          { outcome_index: 1, token_id: 'no-resolved' },
        ],
      },
      {
        condition_id: 'market-open-2',
        is_resolved: false,
        outcomes: [
          { outcome_index: 0, token_id: 'yes-2' },
          { outcome_index: 1, token_id: 'no-2' },
        ],
      },
    ] as any)

    expect(targets).toEqual([
      {
        conditionId: 'market-open-1',
        tokenId: 'yes-1',
      },
      {
        conditionId: 'market-open-2',
        tokenId: 'yes-2',
      },
    ])
  })
})
