import { describe, expect, it } from 'vitest'
import {
  BLOCKED_COUNTRIES_SETTINGS_KEY,
  getBlockedCountriesFromSettings,
  getRequestCountryCode,
  isCountryBlocked,
  validateBlockedCountriesInput,
} from '@/lib/geoblock-settings'

describe('geoblock settings helpers', () => {
  it('reads blocked countries from settings json', () => {
    expect(getBlockedCountriesFromSettings({
      general: {
        [BLOCKED_COUNTRIES_SETTINGS_KEY]: {
          value: '[" us ","BR","US"]',
          updated_at: new Date().toISOString(),
        },
      },
    })).toEqual(['US', 'BR'])
  })

  it('accepts empty blocked countries input', () => {
    expect(validateBlockedCountriesInput('').data).toEqual({
      blockedCountries: [],
      blockedCountriesValue: '[]',
    })
  })

  it('normalizes and deduplicates blocked countries input', () => {
    expect(validateBlockedCountriesInput('us, br\nUS fr').data).toEqual({
      blockedCountries: ['US', 'BR', 'FR'],
      blockedCountriesValue: '["US","BR","FR"]',
    })
  })

  it('rejects invalid blocked country codes', () => {
    expect(validateBlockedCountriesInput('US,ZZ').error).toBe('Invalid country code: ZZ.')
  })

  it('reads request country from known edge headers', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'br',
    })

    expect(getRequestCountryCode(headers)).toBe('BR')
  })

  it('matches blocked country status', () => {
    expect(isCountryBlocked('US', ['BR', 'US'])).toBe(true)
    expect(isCountryBlocked('AR', ['BR', 'US'])).toBe(false)
    expect(isCountryBlocked(null, ['BR', 'US'])).toBe(false)
  })
})
