import type { ReactElement } from 'react'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deferPublicShellPrerenderIfNeeded: vi.fn(),
  getPublicRuntimeConfig: vi.fn(),
  loadEnabledLocales: vi.fn(),
  loadGlobalAnnouncementSettings: vi.fn(),
  loadRuntimeThemeState: vi.fn(),
  setRequestLocale: vi.fn(),
}))

vi.mock('next-intl', () => ({
  hasLocale: () => true,
  NextIntlClientProvider: 'next-intl-provider',
}))

vi.mock('next-intl/server', () => ({
  setRequestLocale: (...args: unknown[]) => mocks.setRequestLocale(...args),
}))

vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}))

vi.mock('@/components/CustomJavascriptCode', () => ({ default: 'custom-javascript-code' }))
vi.mock('@/components/GlobalAnnouncementBanner', () => ({ default: 'global-announcement-banner' }))
vi.mock('@/components/PublicRuntimeConfigScript', () => ({ default: 'public-runtime-config-script' }))
vi.mock('@/components/PwaInstallStateSync', () => ({ default: 'pwa-install-state-sync' }))
vi.mock('@/components/PwaServiceWorker', () => ({ default: 'pwa-service-worker' }))
vi.mock('@/components/seo/SiteStructuredData', () => ({ default: 'site-structured-data' }))
vi.mock('@/components/TestModeBannerDeferred', () => ({ default: 'test-mode-banner' }))

vi.mock('@/i18n/locale-settings', () => ({
  loadEnabledLocales: (...args: unknown[]) => mocks.loadEnabledLocales(...args),
}))

vi.mock('@/lib/fonts', () => ({
  openSauceOne: { variable: 'font-open-sauce-one' },
}))

vi.mock('@/lib/global-announcement-settings', () => ({
  loadGlobalAnnouncementSettings: (...args: unknown[]) => mocks.loadGlobalAnnouncementSettings(...args),
}))

vi.mock('@/lib/public-runtime-config.server', () => ({
  getPublicRuntimeConfig: (...args: unknown[]) => mocks.getPublicRuntimeConfig(...args),
}))

vi.mock('@/lib/public-shell-rendering', () => ({
  deferPublicShellPrerenderIfNeeded: (...args: unknown[]) => mocks.deferPublicShellPrerenderIfNeeded(...args),
  shouldPrerenderPublicShell: () => false,
}))

vi.mock('@/lib/theme-settings', () => ({
  loadRuntimeThemeState: (...args: unknown[]) => mocks.loadRuntimeThemeState(...args),
}))

vi.mock('@/providers/AppProviders', () => ({ AppProviders: 'app-providers' }))
vi.mock('@/providers/PublicRuntimeConfigProvider', () => ({ default: 'public-runtime-config-provider' }))
vi.mock('@/providers/SiteIdentityProvider', () => ({ default: 'site-identity-provider' }))

describe('locale layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deferPublicShellPrerenderIfNeeded.mockResolvedValue(undefined)
    mocks.loadEnabledLocales.mockResolvedValue(['en'])
    mocks.loadRuntimeThemeState.mockResolvedValue({
      site: {
        customJavascriptCodes: [],
      },
      theme: {
        cssText: '',
        presetId: 'default',
      },
    })
    mocks.getPublicRuntimeConfig.mockReturnValue({})
    mocks.loadGlobalAnnouncementSettings.mockResolvedValue({
      disableFaucetBanner: false,
      disabledOn: [],
      linkUrl: null,
      message: '',
    })
  })

  it('returns a complete runtime body without a document-wide Suspense fallback', async () => {
    const { default: LocaleLayout, instant } = await import('@/app/[locale]/layout')
    const children = <main>Visible homepage</main>

    const layout = await LocaleLayout({
      children,
      params: Promise.resolve({ locale: 'en' }),
    } as LayoutProps<'/[locale]'>) as ReactElement
    const RuntimeLocaleDocument = layout.type as (props: typeof layout.props) => Promise<ReactElement>
    const document = await RuntimeLocaleDocument(layout.props)
    const body = document.props.children as ReactElement

    expect(instant).toBe(false)
    expect(document.type).toBe('html')
    expect(body.type).not.toBe(Suspense)
    expect(body.props.children).toBe(children)
    expect(mocks.deferPublicShellPrerenderIfNeeded).toHaveBeenCalledOnce()
    expect(mocks.loadRuntimeThemeState).toHaveBeenCalledOnce()
  })
})
