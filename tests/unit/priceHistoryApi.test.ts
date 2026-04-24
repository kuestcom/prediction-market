import { describe, expect, it } from 'vitest'
import {
  buildBatchPriceHistoryRequestBody,
  mapTokenHistoryToConditionHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/priceHistoryApi'

describe('priceHistoryApi', () => {
  it('builds a batch price history request body with numeric filters', () => {
    expect(buildBatchPriceHistoryRequestBody(['token-1', 'token-2'], {
      fidelity: '720',
      startTs: '100',
      endTs: '200',
    })).toEqual({
      markets: ['token-1', 'token-2'],
      fidelity: 720,
      startTs: 100,
      endTs: 200,
    })
  })

  it('maps token histories back to condition ids', () => {
    expect(mapTokenHistoryToConditionHistory([
      { conditionId: 'market-1', tokenId: 'token-1' },
      { conditionId: 'market-2', tokenId: 'token-2' },
    ], {
      'token-1': [{ t: 1, p: 0.2 }],
    })).toEqual({
      'market-1': [{ t: 1, p: 0.2 }],
      'market-2': [],
    })
  })
})
