import { describe, expect, it } from 'vitest'
import {
  mergeAllowedMarketCreatorWallets,
  parseLegacyAllowedMarketCreatorWallets,
} from '@/lib/allowed-market-creators-server'

describe('allowed market creators server helpers', () => {
  it('parses legacy market creators setting into normalized wallets', () => {
    expect(parseLegacyAllowedMarketCreatorWallets(`
      0x1111111111111111111111111111111111111111
      not-a-wallet
      0x2222222222222222222222222222222222222222
    `)).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])
  })

  it('merges persisted and legacy wallets without casing duplicates', () => {
    expect(mergeAllowedMarketCreatorWallets(
      ['0x1111111111111111111111111111111111111111'],
      ['0x1111111111111111111111111111111111111111', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      ['0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'],
    )).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ])
  })
})
