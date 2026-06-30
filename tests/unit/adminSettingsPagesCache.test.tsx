import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  getExtracted: vi.fn(),
  setRequestLocale: vi.fn(),
  getSettings: vi.fn(),
  parseMarketContextSettings: vi.fn(),
}))

vi.mock('next/cache', () => ({
  cacheTag: (...args: any[]) => mocks.cacheTag(...args),
}))

vi.mock('next-intl/server', () => ({
  getExtracted: (...args: any[]) => mocks.getExtracted(...args),
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/ai/market-context-config', () => ({
  parseMarketContextSettings: (...args: any[]) => mocks.parseMarketContextSettings(...args),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  fetchOpenRouterModels: vi.fn(),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-general-settings-form' }),
}))

vi.mock('@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-theme-settings-form' }),
}))

vi.mock('@/app/[locale]/admin/market-context/_components/AdminMarketContextSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-market-context-settings-form' }),
}))

describe('admin settings pages cache tags', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cacheTag.mockReset()
    mocks.getExtracted.mockReset()
    mocks.setRequestLocale.mockReset()
    mocks.getSettings.mockReset()
    mocks.parseMarketContextSettings.mockReset()

    mocks.getExtracted.mockResolvedValue((value: string) => value)
    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.parseMarketContextSettings.mockReturnValue({
      apiKey: undefined,
      model: undefined,
      prompt: 'Prompt',
      enabled: true,
    })
  })

  it('tags cached admin pages that render settings-backed initial state', async () => {
    const [
      { default: AdminGeneralSettingsPage },
      { default: AdminThemeSettingsPage },
      { default: AdminMarketContextSettingsPage },
      { cacheTags },
    ] = await Promise.all([
      import('@/app/[locale]/admin/(general)/page'),
      import('@/app/[locale]/admin/theme/page'),
      import('@/app/[locale]/admin/market-context/page'),
      import('@/lib/cache-tags'),
    ])

    const params = Promise.resolve({ locale: 'en' })

    await AdminGeneralSettingsPage({ params })
    await AdminThemeSettingsPage({ params } as any)
    await AdminMarketContextSettingsPage({ params } as any)

    expect(mocks.cacheTag).toHaveBeenCalledTimes(3)
    expect(mocks.cacheTag).toHaveBeenNthCalledWith(1, cacheTags.settings)
    expect(mocks.cacheTag).toHaveBeenNthCalledWith(2, cacheTags.settings)
    expect(mocks.cacheTag).toHaveBeenNthCalledWith(3, cacheTags.settings)
  })
})
