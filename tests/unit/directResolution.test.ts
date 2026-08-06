import { describe, expect, it } from 'vitest'

import type { Event } from '@/types'

import { DRO_CTF_ADAPTER_V4_ADDRESS, NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS } from '@/lib/contracts'
import {
  getDirectResolutionAdapterAddress,
  isDirectResolutionConfiguration,
  readDirectResolutionError,
  resolveResolutionActorAddress,
} from '@/lib/direct-resolution'

function buildMarket({
  metadata,
  oracle,
  negRisk = false,
}: {
  metadata?: Record<string, unknown>
  oracle: string
  negRisk?: boolean
}) {
  return {
    metadata,
    neg_risk: negRisk,
    condition: {
      oracle,
    },
  } as Event['markets'][number]
}

describe('direct resolution helpers', () => {
  it('keeps an authenticated resolution identity while AppKit restores its address', () => {
    const authenticatedAddress = '0x1111111111111111111111111111111111111111'

    expect(resolveResolutionActorAddress(null, authenticatedAddress)).toBe(authenticatedAddress)
  })

  it('gives an explicit UMA resolution type precedence over direct adapter addresses', () => {
    expect(
      isDirectResolutionConfiguration({
        oracle: DRO_CTF_ADAPTER_V4_ADDRESS,
        metadata: { resolution_type: 'uma_moov2' },
      }),
    ).toBe(false)
  })

  it('gives an explicit direct resolution type precedence over unrecognized addresses', () => {
    expect(
      isDirectResolutionConfiguration({
        oracle: '0x1111111111111111111111111111111111111111',
        metadata: { resolution_type: 'dro_moov2' },
      }),
    ).toBe(true)
  })

  it('uses the configured standard DRO adapter instead of untrusted market addresses', () => {
    const metadataAdapter = '0x2222222222222222222222222222222222222222'
    const conditionOracle = '0x1111111111111111111111111111111111111111'

    expect(
      getDirectResolutionAdapterAddress(
        buildMarket({
          metadata: {
            resolution_adapter_address: metadataAdapter,
          },
          oracle: conditionOracle,
        }),
      ),
    ).toBe(DRO_CTF_ADAPTER_V4_ADDRESS)
  })

  it('uses the configured neg-risk DRO adapter for neg-risk markets', () => {
    const conditionOracle = '0x1111111111111111111111111111111111111111'

    expect(
      getDirectResolutionAdapterAddress(
        buildMarket({
          metadata: {},
          oracle: conditionOracle,
          negRisk: true,
        }),
      ),
    ).toBe(NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS)
  })

  it('maps direct resolution gas fee errors to a short user-facing message', () => {
    expect(
      readDirectResolutionError(
        'RPC submit: transaction gas price below minimum: gas tip cap 1 below minimum needed 25000000000',
      ),
    ).toBe('Transaction could not be sent because the gas fee is below the current network minimum.')
  })

  it('maps direct resolution wallet and balance errors', () => {
    expect(readDirectResolutionError('insufficient funds for gas * price + value')).toBe(
      'Connected proposer wallet needs POL for gas before resolving this market.',
    )
    expect(readDirectResolutionError('User rejected the request')).toBe('Wallet signature was rejected.')
  })

  it('hides raw direct resolution contract errors behind a generic message', () => {
    expect(readDirectResolutionError('The contract function "proposeAndResolve" reverted with RPC details')).toBe(
      'Could not submit resolution.',
    )
  })

  it('does not treat generic provider not allowed errors as proposer authorization failures', () => {
    expect(readDirectResolutionError('requested rpc call is not allowed by this wallet provider')).toBe(
      'Could not submit resolution.',
    )
  })

  it('maps direct resolution proposer authorization errors when explicitly reported', () => {
    expect(readDirectResolutionError('execution reverted: NotWhitelisted')).toBe(
      'You are not allowed to propose a result for this market.',
    )
    expect(readDirectResolutionError('execution reverted: unauthorized proposer')).toBe(
      'You are not allowed to propose a result for this market.',
    )
  })
})
