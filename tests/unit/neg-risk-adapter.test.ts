import { describe, expect, it } from 'vitest'
import {
  NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'
import {
  assertCurrentNegRiskAdapterAddress,
  isCurrentNegRiskAdapterAddress,
  resolveNegRiskAdapterAddressFromMetadata,
} from '@/lib/neg-risk-adapter'

describe('neg risk adapter helpers', () => {
  it('reads the resolution adapter address from market metadata', () => {
    expect(resolveNegRiskAdapterAddressFromMetadata({
      resolution_adapter_address: NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
    })).toBe(NEGRISK_UMA_CTF_ADAPTER_ADDRESS)
  })

  it('maps the resolution adapter oracle to the current executable NegRisk adapter', () => {
    const metadataAddress = resolveNegRiskAdapterAddressFromMetadata({
      resolution_adapter_address: NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
    })

    expect(isCurrentNegRiskAdapterAddress(metadataAddress)).toBe(true)
    expect(assertCurrentNegRiskAdapterAddress(metadataAddress)).toBe(UMA_NEG_RISK_ADAPTER_ADDRESS)
  })

  it('falls back to the condition oracle when metadata has no adapter address', () => {
    expect(resolveNegRiskAdapterAddressFromMetadata({}, NEGRISK_UMA_CTF_ADAPTER_ADDRESS))
      .toBe(NEGRISK_UMA_CTF_ADAPTER_ADDRESS)
  })

  it('ignores stale metadata adapters when the condition oracle is supported', () => {
    expect(resolveNegRiskAdapterAddressFromMetadata(
      { adapter_address: '0x00000000000000000000000000000000000000aa' },
      NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
    )).toBe(NEGRISK_UMA_CTF_ADAPTER_ADDRESS)
  })

  it('continues past stale metadata adapters to find a later supported adapter', () => {
    expect(resolveNegRiskAdapterAddressFromMetadata({
      adapter_address: '0x00000000000000000000000000000000000000aa',
      resolution_adapter_address: NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
    })).toBe(NEGRISK_UMA_CTF_ADAPTER_ADDRESS)
  })
})
