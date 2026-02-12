import { describe, expect, it } from 'vitest'
import { getAutomaticTranslationsEnabledFromSettings } from '@/i18n/locale-settings'
import { DEFAULT_LOCALE, normalizeEnabledLocales, parseEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'

describe('locale settings helpers', () => {
  it('normalizes enabled locales in supported order and keeps default', () => {
    const input = ['fr', 'en', 'es']
    expect(normalizeEnabledLocales(input)).toEqual([DEFAULT_LOCALE, 'es', 'fr'])
  })

  it('adds default locale when missing', () => {
    expect(normalizeEnabledLocales(['de'])).toEqual([DEFAULT_LOCALE, 'de'])
  })

  it('parses enabled locales from JSON', () => {
    expect(parseEnabledLocales('["fr","en"]')).toEqual([DEFAULT_LOCALE, 'fr'])
  })

  it('falls back to supported locales on invalid JSON', () => {
    expect(parseEnabledLocales('{bad')).toEqual(SUPPORTED_LOCALES)
  })

  it('falls back to default locale on empty list', () => {
    expect(parseEnabledLocales('[]')).toEqual([DEFAULT_LOCALE])
  })

  it('enables automatic translations by default when setting is missing', () => {
    expect(getAutomaticTranslationsEnabledFromSettings(undefined)).toBe(true)
  })

  it('reads automatic translations disabled flag from settings', () => {
    expect(getAutomaticTranslationsEnabledFromSettings({
      i18n: {
        automatic_translations_enabled: {
          value: 'false',
          updated_at: new Date().toISOString(),
        },
      },
    })).toBe(false)
  })

  it('reads automatic translations enabled flag from settings', () => {
    expect(getAutomaticTranslationsEnabledFromSettings({
      i18n: {
        automatic_translations_enabled: {
          value: 'true',
          updated_at: new Date().toISOString(),
        },
      },
    })).toBe(true)
  })
})
