import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import { DRO_CTF_ADAPTER_V4_ADDRESS } from '@/lib/contracts'
import { getDirectResolutionAdapterAddress } from '@/lib/direct-resolution'

function buildMarket({
  metadata,
  oracle,
}: {
  metadata?: Record<string, unknown>
  oracle: string
}) {
  return {
    metadata,
    neg_risk: false,
    condition: {
      oracle,
    },
  } as Event['markets'][number]
}

describe('direct resolution helpers', () => {
  it('uses an explicit resolution adapter from metadata first', () => {
    const metadataAdapter = '0x2222222222222222222222222222222222222222'
    const conditionOracle = '0x1111111111111111111111111111111111111111'

    expect(getDirectResolutionAdapterAddress(buildMarket({
      metadata: {
        resolution_adapter_address: metadataAdapter,
      },
      oracle: conditionOracle,
    }))).toBe(metadataAdapter)
  })

  it('uses the market condition oracle before the hardcoded DRO adapter fallback', () => {
    const conditionOracle = '0x1111111111111111111111111111111111111111'

    expect(getDirectResolutionAdapterAddress(buildMarket({
      metadata: {},
      oracle: conditionOracle,
    }))).toBe(conditionOracle)
    expect(conditionOracle).not.toBe(DRO_CTF_ADAPTER_V4_ADDRESS)
  })
})
