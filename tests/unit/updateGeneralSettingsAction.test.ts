import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  encryptSecret: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
    updateSettings: (...args: any[]) => mocks.updateSettings(...args),
  },
}))

vi.mock('@/lib/encryption', () => ({
  encryptSecret: (...args: any[]) => mocks.encryptSecret(...args),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: (...args: any[]) => mocks.upload(...args),
      }),
    },
  },
}))

describe('updateGeneralSettingsAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getSettings.mockReset()
    mocks.updateSettings.mockReset()
    mocks.encryptSecret.mockReset()
    mocks.upload.mockReset()
    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.encryptSecret.mockImplementation((value: string) => `enc.v1.${value}`)
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('returns validation errors for invalid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', '')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result.error).toContain('Site name')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('validates wallet fields', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', 'not-a-wallet')
    formData.set('market_creators', '0x3333333333333333333333333333333333333333')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result.error).toContain('Fee recipient wallet')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('saves normalized SVG site settings for valid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', '')
    formData.set('google_analytics_id', 'G-TEST123')
    formData.set('discord_link', 'https://discord.gg/kuest')
    formData.set('support_url', 'https://kuest.com/support')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('market_creators', '0x2222222222222222222222222222222222222222\n0x3333333333333333333333333333333333333333')
    formData.set('lifi_integrator', 'kuest-fork')
    formData.set('lifi_api_key', 'lifi-123')
    formData.set('openrouter_api_key', 'openrouter-123')
    formData.set('openrouter_model', 'openai/gpt-4o-mini')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)
    expect(mocks.encryptSecret).toHaveBeenCalledWith('lifi-123')
    expect(mocks.encryptSecret).toHaveBeenCalledWith('openrouter-123')

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string, key: string, value: string }>
    expect(savedPayload).toHaveLength(14)
    expect(savedPayload.find(entry => entry.key === 'site_name')?.value).toBe('Kuest')
    expect(savedPayload.find(entry => entry.key === 'site_description')?.value).toBe('Prediction market')
    expect(savedPayload.find(entry => entry.key === 'site_logo_mode')?.value).toBe('svg')
    expect(savedPayload.find(entry => entry.key === 'site_logo_image_path')?.value).toBe('')
    expect(savedPayload.find(entry => entry.key === 'site_google_analytics')?.value).toBe('G-TEST123')
    expect(savedPayload.find(entry => entry.key === 'site_discord_link')?.value).toBe('https://discord.gg/kuest')
    expect(savedPayload.find(entry => entry.key === 'site_support_url')?.value).toBe('https://kuest.com/support')
    expect(savedPayload.find(entry => entry.key === 'fee_recipient_wallet')?.value).toBe('0x1111111111111111111111111111111111111111')
    expect(savedPayload.find(entry => entry.key === 'market_creators')?.value).toBe('0x2222222222222222222222222222222222222222\n0x3333333333333333333333333333333333333333')
    expect(savedPayload.find(entry => entry.key === 'lifi_integrator')?.value).toBe('kuest-fork')
    expect(savedPayload.find(entry => entry.key === 'lifi_api_key')?.value).toBe('enc.v1.lifi-123')
    expect(savedPayload.find(entry => entry.group === 'ai' && entry.key === 'openrouter_model')?.value).toBe('openai/gpt-4o-mini')
    expect(savedPayload.find(entry => entry.group === 'ai' && entry.key === 'openrouter_api_key')?.value).toBe('enc.v1.openrouter-123')

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/theme', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/market-context', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout')
  })

  it('saves image-mode settings when an image path already exists', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', 'theme/site-logo.png')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('market_creators', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string, key: string, value: string }>
    expect(savedPayload.find(entry => entry.key === 'site_logo_mode')?.value).toBe('image')
    expect(savedPayload.find(entry => entry.key === 'site_logo_image_path')?.value).toBe('theme/site-logo.png')
  })

  it('keeps the existing encrypted LI.FI key when no new key is provided', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        general: {
          lifi_api_key: { value: 'enc.v1.existing', updated_at: '2026-01-01T00:00:00.000Z' },
        },
        ai: {
          openrouter_api_key: { value: 'enc.v1.existing-openrouter', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('market_creators', '')
    formData.set('lifi_integrator', 'kuest-fork')
    formData.set('lifi_api_key', '')
    formData.set('openrouter_api_key', '')
    formData.set('openrouter_model', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.encryptSecret).not.toHaveBeenCalled()

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string, key: string, value: string }>
    expect(savedPayload.find(entry => entry.key === 'lifi_api_key')?.value).toBe('enc.v1.existing')
    expect(savedPayload.find(entry => entry.group === 'ai' && entry.key === 'openrouter_api_key')?.value).toBe('enc.v1.existing-openrouter')
  })

  it('rejects unsupported logo upload types', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } = await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', '')
    formData.set('logo_image', new File(['hello'], 'logo.txt', { type: 'text/plain' }))

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Logo must be PNG, JPG, WebP, or SVG.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })
})
