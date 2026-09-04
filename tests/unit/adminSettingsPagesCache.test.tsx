import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualNextCache from 'next/cache'
import * as actualNextNavigation from 'next/navigation'
import * as React from 'react'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  io: mock(),
  getExtracted: mock(),
  setRequestLocale: mock(),
  getSettings: mock(),
  redirect: mock(),
}))

void mock.module('next/cache', () => ({
  ...actualNextCache,
  io: (...args: any[]) => mocks.io(...args),
}))

void mock.module('next-intl/server', () => ({
  getExtracted: (...args: any[]) => mocks.getExtracted(...args),
  setRequestLocale: (...args: any[]) => mocks.setRequestLocale(...args),
}))

void mock.module('next/navigation', () => ({
  ...actualNextNavigation,
  redirect: (...args: any[]) => mocks.redirect(...args),
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

void mock.module('@/lib/ai/openrouter', () => ({
  fetchAllOpenRouterModels: mock(),
  fetchOpenRouterModels: mock(),
}))

void mock.module('@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-general-settings-form' }),
}))

void mock.module('@/app/[locale]/admin/integrations/_components/AdminIntegrationsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-integrations-form' }),
}))

void mock.module('@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'admin-theme-settings-form' }),
}))

describe('admin settings pages runtime behavior', () => {
  beforeEach(() => {
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

    await AdminGeneralSettingsPage()
    await AdminIntegrationsPage()
    await AdminThemeSettingsPage({ params } as any)
    await AdminMarketContextSettingsPage({ params } as any)

    expect(mocks.io).not.toHaveBeenCalled()
    expect(mocks.getSettings).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith('/en/admin/general')
  })
})
