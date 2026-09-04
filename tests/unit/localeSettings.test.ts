import { describe, expect, it } from 'bun:test'

import {
  getAutomaticTranslationsEnabledFromSettings,
  getEnabledLocalesFromSettings,
  getEnabledLocalesInOrderFromSettings,
  getLocaleOrderFromSettings,
  getRulesTranslationsEnabledFromSettings,
} from '@/i18n/locale-settings'
import {
  DEFAULT_LOCALE,
  normalizeEnabledLocales,
  parseEnabledLocales,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from '@/i18n/locales'

describe('locale settings helpers', () => {
  it('preserves enabled locale order and keeps default first', () => {
    const input = ['fr', 'en', 'es']
    expect(normalizeEnabledLocales(input)).toEqual([DEFAULT_LOCALE, 'fr', 'es'])
  })

  it('adds default locale when missing', () => {
    expect(normalizeEnabledLocales(['de'])).toEqual([DEFAULT_LOCALE, 'de'])
  })

  it('parses enabled locales from JSON', () => {
    expect(parseEnabledLocales('["fr","en","de"]')).toEqual([DEFAULT_LOCALE, 'fr', 'de'])
  })

  it('uses the stored order for enabled locales', () => {
    expect(
      getEnabledLocalesFromSettings({
        i18n: {
          enabled_locales: {
            value: '["pt","en","de"]',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toEqual([DEFAULT_LOCALE, 'pt', 'de'])
  })

  it('uses the stored order for all locales', () => {
    expect(
      getLocaleOrderFromSettings({
        i18n: {
          locale_order: {
            value: '["pt","en","de"]',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toEqual(['en', 'pt', 'de', 'es', 'fr', 'zh', 'ja', 'ar', 'ru', 'it', 'pl', 'ko'])
  })

  it('filters disabled locales while preserving the configured order', () => {
    expect(
      getEnabledLocalesInOrderFromSettings({
        i18n: {
          enabled_locales: {
            value: '["en","pt","zh"]',
            updated_at: new Date().toISOString(),
          },
          locale_order: {
            value: '["zh","de","en","pt"]',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toEqual(['en', 'zh', 'pt'])
  })

  it('falls back to the enabled order when the full order is not stored', () => {
    expect(getLocaleOrderFromSettings(undefined)).toBeNull()
  })

  it('falls back to supported locales on invalid JSON', () => {
    expect(parseEnabledLocales('{bad')).toEqual(SUPPORTED_LOCALES)
  })

  it('falls back to default locale on empty list', () => {
    expect(parseEnabledLocales('[]')).toEqual([DEFAULT_LOCALE])
  })

  it('resolves supported locales from runtime route values', () => {
    expect(resolveSupportedLocale(' PT ')).toBe('pt')
    expect(resolveSupportedLocale('__placeholder__')).toBe(DEFAULT_LOCALE)
  })

  it('enables automatic translations by default when setting is missing', () => {
    expect(getAutomaticTranslationsEnabledFromSettings(undefined)).toBe(true)
  })

  it('reads automatic translations disabled flag from settings', () => {
    expect(
      getAutomaticTranslationsEnabledFromSettings({
        i18n: {
          automatic_translations_enabled: {
            value: 'false',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(false)
  })

  it('reads automatic translations enabled flag from settings', () => {
    expect(
      getAutomaticTranslationsEnabledFromSettings({
        i18n: {
          automatic_translations_enabled: {
            value: 'true',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(true)
  })

  it('keeps Rules translations disabled when the setting is missing', () => {
    expect(getRulesTranslationsEnabledFromSettings(undefined)).toBe(false)
  })

  it('reads the Rules translations enabled flag from settings', () => {
    expect(
      getRulesTranslationsEnabledFromSettings({
        i18n: {
          rules_translations_enabled: {
            value: 'true',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toBe(true)
  })
})
