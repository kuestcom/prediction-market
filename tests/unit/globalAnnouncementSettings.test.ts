import { describe, expect, it } from 'bun:test'

import type { SupportedLocale } from '@/i18n/locales'

import { SUPPORTED_LOCALES } from '@/i18n/locales'
import {
  DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
  getGlobalAnnouncementSettingsFromSettings,
  localizeGlobalAnnouncementMessage,
  MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH,
  validateGlobalAnnouncementInput,
} from '@/lib/global-announcement-settings'

describe('global announcement settings helpers', () => {
  it('localizes the mainnet migration announcement for every supported locale', () => {
    const expectedTranslations: Record<SupportedLocale, string> = {
      en: 'Last call to move to Mainnet',
      de: 'Letzte Aufforderung zum Wechsel ins Mainnet',
      es: 'Último aviso para migrar a la red principal',
      pt: 'Último aviso para migrar para a rede principal',
      fr: 'Dernier rappel pour passer au réseau principal',
      zh: '迁移至主网的最后提醒',
      ja: 'メインネット移行の最終案内',
      ar: 'التنبيه الأخير للانتقال إلى الشبكة الرئيسية',
      ru: 'Последнее напоминание о переходе в основную сеть',
      it: 'Ultimo avviso per passare alla rete principale',
      pl: 'Ostatnie przypomnienie o przejściu do sieci głównej',
      ko: '메인넷 전환 최종 안내',
    }

    for (const locale of SUPPORTED_LOCALES) {
      expect(localizeGlobalAnnouncementMessage(locale, 'Last call to move to Mainnet')).toBe(
        expectedTranslations[locale],
      )
    }

    expect(localizeGlobalAnnouncementMessage('zh', 'A custom announcement')).toBe('A custom announcement')
  })

  it('returns empty defaults when settings are missing', () => {
    expect(getGlobalAnnouncementSettingsFromSettings(undefined)).toEqual({
      message: '',
      linkUrl: '',
      disabledOn: DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
      disableFaucetBanner: false,
    })
  })

  it('reads and trims values from settings', () => {
    expect(
      getGlobalAnnouncementSettingsFromSettings({
        general: {
          global_announcement_message: {
            value: '  Promo this week  ',
            updated_at: new Date().toISOString(),
          },
          global_announcement_link_url: {
            value: '  /campaign  ',
            updated_at: new Date().toISOString(),
          },
          global_announcement_disabled_on: {
            value: '["home","docs","home"]',
            updated_at: new Date().toISOString(),
          },
          global_announcement_disable_faucet_banner: {
            value: 'true',
            updated_at: new Date().toISOString(),
          },
        },
      }),
    ).toEqual({
      message: 'Promo this week',
      linkUrl: '/campaign',
      disabledOn: ['home', 'docs'],
      disableFaucetBanner: true,
    })
  })

  it('accepts empty input', () => {
    const result = validateGlobalAnnouncementInput({
      message: '',
      linkUrl: '',
      disabledOnJson: '',
      disableFaucetBanner: '',
    })

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      messageValue: '',
      linkUrlValue: '',
      disabledOn: DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
      disabledOnValue: JSON.stringify(DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON),
      disableFaucetBanner: false,
      disableFaucetBannerValue: 'false',
    })
  })

  it('accepts the disable faucet banner flag', () => {
    const result = validateGlobalAnnouncementInput({
      message: '',
      linkUrl: '',
      disabledOnJson: '',
      disableFaucetBanner: 'true',
    })

    expect(result.error).toBeNull()
    expect(result.data?.disableFaucetBanner).toBe(true)
    expect(result.data?.disableFaucetBannerValue).toBe('true')
  })

  it('accepts http(s) and internal links', () => {
    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: 'https://example.com',
        disabledOnJson: '["admin"]',
        disableFaucetBanner: '',
      }).error,
    ).toBeNull()

    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: '/markets/new',
        disabledOnJson: '["home","event"]',
        disableFaucetBanner: '',
      }).error,
    ).toBeNull()

    const explicitEmptyDisabledPages = validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '/markets/new',
      disabledOnJson: '[]',
      disableFaucetBanner: '',
    })
    expect(explicitEmptyDisabledPages.error).toBeNull()
    expect(explicitEmptyDisabledPages.data?.disabledOn).toEqual([])
  })

  it('rejects invalid links', () => {
    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: 'javascript:alert(1)',
        disabledOnJson: '["admin"]',
        disableFaucetBanner: '',
      }).error,
    ).not.toBeNull()

    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: '//example.com',
        disabledOnJson: '["admin"]',
        disableFaucetBanner: '',
      }).error,
    ).not.toBeNull()
  })

  it('rejects invalid disabled pages payload', () => {
    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: '',
        disabledOnJson: '{"home":true}',
        disableFaucetBanner: '',
      }).error,
    ).not.toBeNull()

    expect(
      validateGlobalAnnouncementInput({
        message: 'A',
        linkUrl: '',
        disabledOnJson: '["unknown"]',
        disableFaucetBanner: '',
      }).error,
    ).not.toBeNull()
  })

  it('rejects too long messages', () => {
    const result = validateGlobalAnnouncementInput({
      message: 'a'.repeat(MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH + 1),
      linkUrl: '',
      disabledOnJson: '["admin"]',
      disableFaucetBanner: '',
    })

    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
  })
})
