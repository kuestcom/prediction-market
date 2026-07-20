import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  updateTag: mocks.updateTag,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: mocks.getSettings,
    updateSettings: mocks.updateSettings,
  },
}))

vi.mock('@/lib/encryption', () => ({
  decryptSecret: (value: string) => value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : '',
  encryptSecret: (value: string) => `encrypted:${value}`,
}))

function formData() {
  const data = new FormData()
  data.set('google_analytics_id', 'G-ABC123')
  data.set('openrouter_api_key', 'openrouter-key')
  data.set('openrouter_model', 'model-1')
  data.set('sports_thesportsdb_api_key', 'sports-key')
  data.set('sports_pandascore_token', 'panda-token')
  data.set('lifi_integrator', 'kuest')
  data.set('lifi_api_key', 'lifi-key')
  data.set('custom_javascript_codes_json', '')
  data.set('arbitrage_enabled', 'true')
  data.set('arbitrage_multi_wallet_enabled', 'false')
  data.set('sumsub_enabled', 'false')
  data.set('sumsub_enforcement', 'disabled')
  data.set('sumsub_level_name', '')
  data.set('sumsub_app_token', '')
  data.set('sumsub_secret_key', '')
  data.set('sumsub_webhook_secret', '')
  return data
}

describe('updateIntegrationsSettingsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.updateSettings.mockResolvedValue({ data: [], error: null })
  })

  it('rejects non-admin users without reading or writing settings', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const { updateIntegrationsSettingsAction } = await import('@/app/[locale]/admin/integrations/_actions/update-integrations-settings')

    await expect(updateIntegrationsSettingsAction({ error: null }, formData()))
      .resolves
      .toEqual({ error: 'Unauthenticated.' })
    expect(mocks.getSettings).not.toHaveBeenCalled()
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('updates only settings owned by the Integrations page', async () => {
    const { updateIntegrationsSettingsAction } = await import('@/app/[locale]/admin/integrations/_actions/update-integrations-settings')

    await expect(updateIntegrationsSettingsAction({ error: null }, formData()))
      .resolves
      .toEqual({ error: null })

    const rows = mocks.updateSettings.mock.calls[0]?.[0] as Array<{ group: string, key: string, value: string }>
    expect(rows).toEqual(expect.arrayContaining([
      { group: 'general', key: 'site_google_analytics', value: 'G-ABC123' },
      { group: 'general', key: 'lifi_api_key', value: 'encrypted:lifi-key' },
      { group: 'ai', key: 'openrouter_api_key', value: 'encrypted:openrouter-key' },
      { group: 'ai', key: 'sports_thesportsdb_api_key', value: 'encrypted:sports-key' },
      { group: 'ai', key: 'sports_pandascore_token', value: 'encrypted:panda-token' },
      { group: 'integrations', key: 'arbitrage_enabled', value: 'true' },
      { group: 'integrations', key: 'sumsub_enforcement', value: 'disabled' },
    ]))
    expect(rows.some(row => [
      'site_name',
      'site_description',
      'site_logo_mode',
      'site_discord_link',
      'global_announcement_message',
      'terms_of_service_pdf_path',
    ].includes(row.key))).toBe(false)
    expect(mocks.updateTag).toHaveBeenCalledWith('settings')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/integrations', 'page')
  })

  it('preserves configured secrets when their fields stay blank', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        general: { lifi_api_key: { value: 'encrypted:old-lifi' } },
        ai: {
          openrouter_api_key: { value: 'encrypted:old-openrouter' },
          sports_thesportsdb_api_key: { value: 'encrypted:old-sports' },
          sports_pandascore_token: { value: 'encrypted:old-panda' },
        },
        integrations: {
          sumsub_app_token: { value: 'encrypted:old-sumsub-app-token' },
          sumsub_secret_key: { value: 'encrypted:old-sumsub-secret-key' },
          sumsub_webhook_secret: { value: 'encrypted:old-sumsub-webhook-secret' },
        },
      },
      error: null,
    })
    const data = formData()
    data.set('lifi_api_key', '')
    data.set('openrouter_api_key', '')
    data.set('sports_thesportsdb_api_key', '')
    data.set('sports_pandascore_token', '')
    const { updateIntegrationsSettingsAction } = await import('@/app/[locale]/admin/integrations/_actions/update-integrations-settings')

    await updateIntegrationsSettingsAction({ error: null }, data)

    const rows = mocks.updateSettings.mock.calls[0]?.[0] as Array<{ key: string, value: string }>
    expect(rows.find(row => row.key === 'lifi_api_key')?.value).toBe('encrypted:old-lifi')
    expect(rows.find(row => row.key === 'openrouter_api_key')?.value).toBe('encrypted:old-openrouter')
    expect(rows.find(row => row.key === 'sports_thesportsdb_api_key')?.value).toBe('encrypted:old-sports')
    expect(rows.find(row => row.key === 'sports_pandascore_token')?.value).toBe('encrypted:old-panda')
    expect(rows.find(row => row.key === 'sumsub_app_token')?.value).toBe('encrypted:old-sumsub-app-token')
    expect(rows.find(row => row.key === 'sumsub_secret_key')?.value).toBe('encrypted:old-sumsub-secret-key')
    expect(rows.find(row => row.key === 'sumsub_webhook_secret')?.value).toBe('encrypted:old-sumsub-webhook-secret')
  })
})
