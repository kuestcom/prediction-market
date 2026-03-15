import { describe, expect, it } from 'vitest'
import {
  groupAllowedMarketCreatorItems,
  isPublicAllowedMarketCreatorsResponse,
  normalizeAllowedMarketCreatorSiteInput,
} from '@/lib/allowed-market-creators'

describe('allowed market creators helpers', () => {
  it('normalizes a bare domain into an https endpoint', () => {
    const result = normalizeAllowedMarketCreatorSiteInput('site2.com')

    expect('error' in result).toBe(false)
    if ('error' in result) {
      return
    }

    expect(result.origin).toBe('https://site2.com')
    expect(result.displayName).toBe('site2.com')
    expect(result.endpointUrl).toBe('https://site2.com/api/allowed-market-creators')
  })

  it('rejects invalid site input', () => {
    const result = normalizeAllowedMarketCreatorSiteInput('://bad-url')
    expect(result).toEqual({ error: 'Site URL is invalid.' })
  })

  it('rejects localhost and private-network site inputs', () => {
    expect(normalizeAllowedMarketCreatorSiteInput('http://localhost:3000')).toEqual({
      error: 'Site URL must point to a public host.',
    })
    expect(normalizeAllowedMarketCreatorSiteInput('http://127.0.0.1:3000')).toEqual({
      error: 'Site URL must point to a public host.',
    })
    expect(normalizeAllowedMarketCreatorSiteInput('https://192.168.1.10')).toEqual({
      error: 'Site URL must point to a public host.',
    })
  })

  it('groups site-backed rows into one removable source item', () => {
    expect(groupAllowedMarketCreatorItems([
      {
        walletAddress: '0x1111111111111111111111111111111111111111',
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x2222222222222222222222222222222222222222',
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
        displayName: 'Wallet 1',
        sourceUrl: null,
        sourceType: 'wallet',
      },
    ])).toEqual([
      {
        walletAddress: null,
        walletCount: 2,
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
        walletCount: 1,
        displayName: 'Wallet 1',
        sourceUrl: null,
        sourceType: 'wallet',
      },
    ])
  })

  it('validates the public endpoint response shape', () => {
    expect(isPublicAllowedMarketCreatorsResponse({
      wallets: ['0x1111111111111111111111111111111111111111'],
    })).toBe(true)

    expect(isPublicAllowedMarketCreatorsResponse(['0x1111111111111111111111111111111111111111'])).toBe(false)
  })
})
