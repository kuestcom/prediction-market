import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  io: vi.fn(),
  getExtracted: vi.fn(),
  setRequestLocale: vi.fn(),
  getSettings: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  io: (...args: any[]) => mocks.io(...args),
}))

vi.mock('next-intl/server', () => ({
  getExtracted: (...args: any[]) => mocks.getExtracted(...args),
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: any[]) => mocks.redirect(...args),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/ai/openrouter', () => ({
  fetchOpenRouterModels: vi.fn(),
}))

vi.mock('@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-general-settings-form' }),
}))

vi.mock('@/app/[locale]/admin/integrations/_components/AdminIntegrationsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-integrations-form' }),
}))

vi.mock('@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-theme-settings-form' }),
}))

describe('admin settings pages runtime behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.io.mockReset()
    mocks.getExtracted.mockReset()
    mocks.setRequestLocale.mockReset()
    mocks.getSettings.mockReset()
    mocks.redirect.mockReset()

    mocks.getExtracted.mockResolvedValue((value: string) => value)
  })

  it('does not read settings while rendering the page shell', async () => {
    const [
      { default: AdminGeneralSettingsPage },
      { default: AdminIntegrationsPage },
      { default: AdminThemeSettingsPage },
      { default: AdminMarketContextSettingsPage },
    ] = await Promise.all([
      import('@/app/[locale]/admin/general/page'),
      import('@/app/[locale]/admin/integrations/page'),
      import('@/app/[locale]/admin/theme/page'),
      import('@/app/[locale]/admin/market-context/page'),
    ])

    const params = Promise.resolve({ locale: 'en' })

    await AdminGeneralSettingsPage({ params })
    await AdminIntegrationsPage({ params })
    await AdminThemeSettingsPage({ params } as any)
    await AdminMarketContextSettingsPage({ params } as any)

    expect(mocks.io).not.toHaveBeenCalled()
    expect(mocks.getSettings).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith('/en/admin/general')
  })
})
