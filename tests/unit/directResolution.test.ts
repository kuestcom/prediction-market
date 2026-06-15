import type { Event } from '@/types'
import { describe, expect, it } from 'vitest'
import { DRO_CTF_ADAPTER_V4_ADDRESS } from '@/lib/contracts'
import { getDirectResolutionAdapterAddress, readDirectResolutionError } from '@/lib/direct-resolution'

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

  it('maps direct resolution gas fee errors to a short user-facing message', () => {
    expect(readDirectResolutionError('RPC submit: transaction gas price below minimum: gas tip cap 1 below minimum needed 25000000000'))
      .toBe('Transaction could not be sent because the gas fee is below the current network minimum.')
  })

  it('maps direct resolution wallet and balance errors', () => {
    expect(readDirectResolutionError('insufficient funds for gas * price + value'))
      .toBe('Connected proposer wallet needs POL for gas before resolving this market.')
    expect(readDirectResolutionError('User rejected the request'))
      .toBe('Wallet signature was rejected.')
  })

  it('hides raw direct resolution contract errors behind a generic message', () => {
    expect(readDirectResolutionError('The contract function "proposeAndResolve" reverted with RPC details'))
      .toBe('Could not submit resolution.')
  })

  it('does not treat generic provider not allowed errors as proposer authorization failures', () => {
    expect(readDirectResolutionError('requested rpc call is not allowed by this wallet provider'))
      .toBe('Could not submit resolution.')
  })

  it('maps direct resolution proposer authorization errors when explicitly reported', () => {
    expect(readDirectResolutionError('execution reverted: NotWhitelisted'))
      .toBe('You are not allowed to propose a result for this market.')
    expect(readDirectResolutionError('execution reverted: unauthorized proposer'))
      .toBe('You are not allowed to propose a result for this market.')
  })
})
