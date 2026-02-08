import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  updateSettings: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: { updateSettings: (...args: any[]) => mocks.updateSettings(...args) },
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

describe('updateThemeSiteSettingsAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.updateSettings.mockReset()
    mocks.upload.mockReset()
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateThemeSiteSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-site-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateThemeSiteSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('returns validation errors for invalid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateThemeSiteSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-site-settings')
    const formData = new FormData()
    formData.set('site_name', '')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateThemeSiteSettingsAction({ error: null }, formData)
    expect(result.error).toContain('Site name')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('saves normalized SVG site settings for valid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateThemeSiteSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-site-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', '')

    const result = await updateThemeSiteSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ key: string, value: string }>
    expect(savedPayload).toHaveLength(5)
    expect(savedPayload.find(entry => entry.key === 'site_name')?.value).toBe('Kuest')
    expect(savedPayload.find(entry => entry.key === 'site_description')?.value).toBe('Prediction market')
    expect(savedPayload.find(entry => entry.key === 'site_logo_mode')?.value).toBe('svg')
    expect(savedPayload.find(entry => entry.key === 'site_logo_image_path')?.value).toBe('')

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/theme', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout')
  })

  it('saves image-mode settings when an image path already exists', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateThemeSiteSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-site-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', 'theme/site-logo.png')

    const result = await updateThemeSiteSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ key: string, value: string }>
    expect(savedPayload.find(entry => entry.key === 'site_logo_mode')?.value).toBe('image')
    expect(savedPayload.find(entry => entry.key === 'site_logo_image_path')?.value).toBe('theme/site-logo.png')
  })

  it('rejects unsupported logo upload types', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateThemeSiteSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-site-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
    formData.set('logo_image_path', '')
    formData.set('logo_image', new File(['hello'], 'logo.txt', { type: 'text/plain' }))

    const result = await updateThemeSiteSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Logo must be PNG, JPG, WebP, or SVG.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })
})
