import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  loadOpenRouterProviderSettings: mock(),
  updateSettings: mock(),
  revalidatePath: mock(),
}))

void mock.module('next/cache', () => ({
  revalidatePath: (...args: any[]) => mocks.revalidatePath(...args),
}))

void mock.module('next-intl/server', () => ({
  getExtracted: async () => (message: string) => message,
}))

void mock.module('@/lib/ai/market-context-config', () => ({
  loadOpenRouterProviderSettings: (...args: any[]) => mocks.loadOpenRouterProviderSettings(...args),
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    updateSettings: (...args: any[]) => mocks.updateSettings(...args),
  },
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

const { updateLocalesSettingsAction } = await import('@/app/[locale]/admin/locales/_actions/update-locales-settings')

describe('updateLocalesSettingsAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({ configured: false })
    mocks.updateSettings.mockResolvedValue({ error: null })
  })

  it('does not overwrite locale order when the field is omitted', async () => {
    const formData = new FormData()
    formData.append('enabled_locales', 'en')
    formData.append('enabled_locales', 'pt')
    formData.append('automatic_translations_enabled', 'false')

    await expect(updateLocalesSettingsAction({ error: null }, formData)).resolves.toEqual({ error: null })

    expect(mocks.updateSettings).toHaveBeenCalledWith([
      { group: 'i18n', key: 'enabled_locales', value: '["en","pt"]' },
      { group: 'i18n', key: 'automatic_translations_enabled', value: 'false' },
      { group: 'i18n', key: 'rules_translations_enabled', value: 'false' },
    ])
  })

  it('persists locale order when the field is submitted', async () => {
    const formData = new FormData()
    formData.append('enabled_locales', 'en')
    formData.append('enabled_locales', 'pt')
    formData.append('locale_order', '["en","pt","de"]')
    formData.append('automatic_translations_enabled', 'false')

    await updateLocalesSettingsAction({ error: null }, formData)

    expect(mocks.updateSettings).toHaveBeenCalledWith([
      { group: 'i18n', key: 'enabled_locales', value: '["en","pt"]' },
      {
        group: 'i18n',
        key: 'locale_order',
        value: '["en","pt","de","es","fr","zh","ja","ar","ru","it","pl","ko"]',
      },
      { group: 'i18n', key: 'automatic_translations_enabled', value: 'false' },
      { group: 'i18n', key: 'rules_translations_enabled', value: 'false' },
    ])
  })

  it('persists Rules translations when enabled and OpenRouter is configured', async () => {
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({ configured: true })
    const formData = new FormData()
    formData.append('enabled_locales', 'en')
    formData.append('rules_translations_enabled', 'true')

    await updateLocalesSettingsAction({ error: null }, formData)

    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.arrayContaining([{ group: 'i18n', key: 'rules_translations_enabled', value: 'true' }]),
    )
  })
})
