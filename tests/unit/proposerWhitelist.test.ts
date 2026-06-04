import { describe, expect, it } from 'vitest'
import { readProposerWhitelistError, resolveProposerWhitelistAddress } from '@/lib/proposer-whitelist'

describe('readProposerWhitelistError', () => {
  it('maps underpriced gas errors to a compact user-facing message', () => {
    expect(readProposerWhitelistError('transaction underpriced'))
      .toBe('Transaction could not be sent because the gas fee is below the current network minimum.')
    expect(readProposerWhitelistError('gas tip cap 100 below minimum needed 200'))
      .toBe('Transaction could not be sent because the gas fee is below the current network minimum.')
  })

  it('keeps mapping wallet signature rejection errors', () => {
    expect(readProposerWhitelistError('User rejected the request'))
      .toBe('Wallet signature was rejected.')
  })
})

describe('resolveProposerWhitelistAddress', () => {
  it('returns the first valid address candidate', () => {
    expect(resolveProposerWhitelistAddress(
      null,
      'invalid',
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
    )).toBe('0x00000000000000000000000000000000000000AA')
  })

  it('returns null when no valid address is provided', () => {
    expect(resolveProposerWhitelistAddress(undefined, null, 'invalid')).toBeNull()
  })
})
