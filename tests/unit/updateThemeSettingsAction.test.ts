import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualNextCache from 'next/cache'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  revalidatePath: mock(),
  getCurrentUser: mock(),
  updateSettings: mock(),
}))

void mock.module('next/cache', () => ({
  ...actualNextCache,
  revalidatePath: mocks.revalidatePath,
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: { updateSettings: (...args: any[]) => mocks.updateSettings(...args) },
}))

describe('updateThemeSettingsAction', () => {
  beforeEach(() => {
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.updateSettings.mockReset()
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateThemeSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-settings')
    const formData = new FormData()
    formData.set('preset', 'default')
    formData.set('radius', '')
    formData.set('light_json', '{}')
    formData.set('dark_json', '{}')

    const result = await updateThemeSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('returns validation errors for invalid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateThemeSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-settings')
    const formData = new FormData()
    formData.set('preset', 'default')
    formData.set('radius', '12')
    formData.set('light_json', '{"primary":"rgb(255,0,0)"}')
    formData.set('dark_json', '{}')

    const result = await updateThemeSettingsAction({ error: null }, formData)
    expect(result.error).toContain('Supported formats')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('returns validation errors for invalid radius values', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateThemeSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-settings')
    const formData = new FormData()
    formData.set('preset', 'default')
    formData.set('radius', '12')
    formData.set('light_json', '{}')
    formData.set('dark_json', '{}')

    const result = await updateThemeSettingsAction({ error: null }, formData)
    expect(result.error).toContain('valid CSS length')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('saves normalized theme settings for valid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateThemeSettingsAction } = await import('@/app/[locale]/admin/theme/_actions/update-theme-settings')
    const formData = new FormData()
    formData.set('preset', 'midnight')
    formData.set('radius', '12px')
    formData.set('light_json', '{"primary":"#112233"}')
    formData.set('dark_json', '{"primary":"#445566"}')

    const result = await updateThemeSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ key: string; value: string }>
    expect(savedPayload).toHaveLength(4)

    const savedPreset = savedPayload.find((entry) => entry.key === 'preset')
    const savedRadius = savedPayload.find((entry) => entry.key === 'radius')
    const savedLight = savedPayload.find((entry) => entry.key === 'light_json')
    const savedDark = savedPayload.find((entry) => entry.key === 'dark_json')

    expect(savedPreset?.value).toBe('midnight')
    expect(savedRadius?.value).toBe('12px')
    expect(JSON.parse(savedLight?.value || '{}')).toEqual({ primary: '#112233' })
    expect(JSON.parse(savedDark?.value || '{}')).toEqual({ primary: '#445566' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/theme', 'page')
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/[locale]', 'layout')
  })
})
