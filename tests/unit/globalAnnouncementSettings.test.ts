import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
  getGlobalAnnouncementSettingsFromSettings,
  MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH,
  validateGlobalAnnouncementInput,
} from '@/lib/global-announcement-settings'

describe('global announcement settings helpers', () => {
  it('returns empty defaults when settings are missing', () => {
    expect(getGlobalAnnouncementSettingsFromSettings(undefined)).toEqual({
      message: '',
      linkUrl: '',
      disabledOn: DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
    })
  })

  it('reads and trims values from settings', () => {
    expect(getGlobalAnnouncementSettingsFromSettings({
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
      },
    })).toEqual({
      message: 'Promo this week',
      linkUrl: '/campaign',
      disabledOn: ['home', 'docs'],
    })
  })

  it('accepts empty input', () => {
    const result = validateGlobalAnnouncementInput({
      message: '',
      linkUrl: '',
      disabledOnJson: '',
    })

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      messageValue: '',
      linkUrlValue: '',
      disabledOn: DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON,
      disabledOnValue: JSON.stringify(DEFAULT_GLOBAL_ANNOUNCEMENT_DISABLED_ON),
    })
  })

  it('accepts http(s) and internal links', () => {
    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: 'https://example.com',
      disabledOnJson: '["admin"]',
    }).error).toBeNull()

    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '/markets/new',
      disabledOnJson: '["home","event"]',
    }).error).toBeNull()

    const explicitEmptyDisabledPages = validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '/markets/new',
      disabledOnJson: '[]',
    })
    expect(explicitEmptyDisabledPages.error).toBeNull()
    expect(explicitEmptyDisabledPages.data?.disabledOn).toEqual([])
  })

  it('rejects invalid links', () => {
    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: 'javascript:alert(1)',
      disabledOnJson: '["admin"]',
    }).error).not.toBeNull()

    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '//example.com',
      disabledOnJson: '["admin"]',
    }).error).not.toBeNull()
  })

  it('rejects invalid disabled pages payload', () => {
    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '',
      disabledOnJson: '{"home":true}',
    }).error).not.toBeNull()

    expect(validateGlobalAnnouncementInput({
      message: 'A',
      linkUrl: '',
      disabledOnJson: '["unknown"]',
    }).error).not.toBeNull()
  })

  it('rejects too long messages', () => {
    const result = validateGlobalAnnouncementInput({
      message: 'a'.repeat(MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH + 1),
      linkUrl: '',
      disabledOnJson: '["admin"]',
    })

    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
  })
})
