import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  updateSettings: vi.fn(),
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

function makeValidFormData() {
  const formData = new FormData()
  formData.set('market_context_prompt', 'Write a concise and data-driven market summary for informed traders.')
  return formData
}

describe('updateMarketContextSettingsAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.updateSettings.mockReset()
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateMarketContextSettingsAction } = await import('@/app/[locale]/admin/market-context/_actions/update-market-context-settings')
    const result = await updateMarketContextSettingsAction({ error: null }, makeValidFormData())

    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('saves market_context_enabled when toggled on', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateMarketContextSettingsAction } = await import('@/app/[locale]/admin/market-context/_actions/update-market-context-settings')
    const formData = makeValidFormData()
    formData.set('market_context_enabled', 'true')

    const result = await updateMarketContextSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string, key: string, value: string }>
    expect(savedPayload.find(entry => entry.key === 'market_context_enabled')?.value).toBe('true')
    expect(savedPayload.some(entry => entry.key === 'openrouter_enabled')).toBe(false)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/market-context', 'page')
  })

  it('defaults market_context_enabled to false when field is missing', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateMarketContextSettingsAction } = await import('@/app/[locale]/admin/market-context/_actions/update-market-context-settings')
    const result = await updateMarketContextSettingsAction({ error: null }, makeValidFormData())

    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string, key: string, value: string }>
    expect(savedPayload.find(entry => entry.key === 'market_context_enabled')?.value).toBe('false')
  })
})
