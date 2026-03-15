import { describe, expect, it } from 'vitest'
import {
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

  it('validates the public endpoint response shape', () => {
    expect(isPublicAllowedMarketCreatorsResponse({
      wallets: ['0x1111111111111111111111111111111111111111'],
    })).toBe(true)

    expect(isPublicAllowedMarketCreatorsResponse(['0x1111111111111111111111111111111111111111'])).toBe(false)
  })
})
