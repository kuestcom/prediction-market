import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import type { SupportedLocale } from '@/i18n/locales'
import type { RuntimeThemeState } from '@/lib/theme-settings'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import CustomJavascriptCode from '@/components/CustomJavascriptCode'
import GlobalAnnouncementBanner from '@/components/GlobalAnnouncementBanner'
import PublicRuntimeConfigScript from '@/components/PublicRuntimeConfigScript'
import PwaInstallStateSync from '@/components/PwaInstallStateSync'
import PwaServiceWorker from '@/components/PwaServiceWorker'
import SiteStructuredData from '@/components/seo/SiteStructuredData'
import TestModeBannerDeferred from '@/components/TestModeBannerDeferred'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { routing } from '@/i18n/routing'
import { openSauceOne } from '@/lib/fonts'
import { loadGlobalAnnouncementSettings } from '@/lib/global-announcement-settings'
import { IS_TEST_MODE } from '@/lib/network'
import { getPublicRuntimeConfig } from '@/lib/public-runtime-config.server'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'
import { resolvePwaThemeColors } from '@/lib/pwa-colors'
import resolveSiteUrl from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import { AppProviders } from '@/providers/AppProviders'
import PublicRuntimeConfigProvider from '@/providers/PublicRuntimeConfigProvider'
import SiteIdentityProvider from '@/providers/SiteIdentityProvider'
import '../globals.css'

export async function generateViewport(): Promise<Viewport> {
  await deferPublicShellPrerenderIfNeeded()

  const runtimeTheme = await loadRuntimeThemeState()
  const { lightSurface, darkSurface } = resolvePwaThemeColors(runtimeTheme.theme)

  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: lightSurface },
      { media: '(prefers-color-scheme: dark)', color: darkSurface },
    ],
  }
}

export async function generateMetadata(): Promise<Metadata> {
  await deferPublicShellPrerenderIfNeeded()

  const runtimeTheme = await loadRuntimeThemeState()
  const site = runtimeTheme.site
  const siteUrl = resolveSiteUrl(process.env)
  const defaultTitle = `${site.name} | ${site.description}`
  const fallbackOgImage = new URL('/api/og', siteUrl).toString()
  const socialImage = {
    url: fallbackOgImage,
    width: 1200,
    height: 630,
    alt: `${site.name} social image`,
    type: 'image/png',
  } as const

  return {
    title: {
      template: `%s | ${site.name}`,
      default: defaultTitle,
    },
    description: site.description,
    applicationName: site.name,
    openGraph: {
      type: 'website',
      title: defaultTitle,
      description: site.description,
      siteName: site.name,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: site.description,
      images: [socialImage],
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: site.name,
      statusBarStyle: 'default',
    },
    icons: {
      icon: [
        { url: site.pwaIcon192Url, sizes: '192x192', type: 'image/png' },
        { url: site.pwaIcon512Url, sizes: '512x512', type: 'image/png' },
        { url: site.logoUrl },
      ],
      apple: [{ url: site.appleTouchIconUrl, sizes: '180x180', type: 'image/png' }],
      shortcut: [site.pwaIcon192Url],
    },
  }
}

export async function generateStaticParams() {
  return [{ locale: 'en' }]
}

interface LocaleDocumentProps {
  children: ReactNode
  locale: SupportedLocale
}

interface LocaleRuntimeData {
  globalAnnouncement: Awaited<ReturnType<typeof loadGlobalAnnouncementSettings>>
  hasGlobalAnnouncement: boolean
  publicRuntimeConfig: ReturnType<typeof getPublicRuntimeConfig>
  runtimeTheme: RuntimeThemeState
}

async function loadLocaleRuntimeData(locale: SupportedLocale): Promise<LocaleRuntimeData> {
  await deferPublicShellPrerenderIfNeeded()

  const enabledLocales = await loadEnabledLocales()
  if (!enabledLocales.includes(locale)) {
    notFound()
  }

  const runtimeTheme = await loadRuntimeThemeState()
  const publicRuntimeConfig = getPublicRuntimeConfig()
  const globalAnnouncement = await loadGlobalAnnouncementSettings()
  const hasGlobalAnnouncement = globalAnnouncement.message.trim().length > 0

  setRequestLocale(locale)

  return {
    globalAnnouncement,
    hasGlobalAnnouncement,
    publicRuntimeConfig,
    runtimeTheme,
  }
}

function ThemeDocumentState({
  runtimeTheme,
  syncRootPreset,
}: {
  runtimeTheme: RuntimeThemeState
  syncRootPreset: boolean
}) {
  const setPresetScript = `document.documentElement.setAttribute('data-theme-preset',${JSON.stringify(runtimeTheme.theme.presetId)});`

  return (
    <>
      {syncRootPreset && <script id="theme-preset-sync" dangerouslySetInnerHTML={{ __html: setPresetScript }} />}
      {runtimeTheme.theme.cssText && <style id="theme-vars" dangerouslySetInnerHTML={{ __html: runtimeTheme.theme.cssText }} />}
    </>
  )
}

function LocaleBody({
  children,
  globalAnnouncement,
  hasGlobalAnnouncement,
  locale,
  publicRuntimeConfig,
  runtimeTheme,
  syncRootPreset,
}: LocaleDocumentProps & LocaleRuntimeData & { syncRootPreset: boolean }) {
  return (
    <body className="flex min-h-screen flex-col font-sans">
      <PublicRuntimeConfigScript config={publicRuntimeConfig} />
      <ThemeDocumentState runtimeTheme={runtimeTheme} syncRootPreset={syncRootPreset} />
      <SiteStructuredData locale={locale} site={runtimeTheme.site} />
      <PwaServiceWorker />
      <PublicRuntimeConfigProvider config={publicRuntimeConfig}>
        <SiteIdentityProvider site={runtimeTheme.site}>
          <NextIntlClientProvider locale={locale}>
            <AppProviders>
              {hasGlobalAnnouncement
                ? (
                    <GlobalAnnouncementBanner
                      locale={locale}
                      message={globalAnnouncement.message}
                      linkUrl={globalAnnouncement.linkUrl}
                      disabledOn={globalAnnouncement.disabledOn}
                    />
                  )
                : null}
              {IS_TEST_MODE && !globalAnnouncement.disableFaucetBanner && <TestModeBannerDeferred />}
              <PwaInstallStateSync />
              {children}
              <CustomJavascriptCode locale={locale} codes={runtimeTheme.site.customJavascriptCodes} />
            </AppProviders>
          </NextIntlClientProvider>
        </SiteIdentityProvider>
      </PublicRuntimeConfigProvider>
    </body>
  )
}

async function PrerenderedLocaleDocument({ locale, children }: LocaleDocumentProps) {
  const runtimeData = await loadLocaleRuntimeData(locale)

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={openSauceOne.variable}
      data-theme-preset={runtimeData.runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <LocaleBody
        {...runtimeData}
        locale={locale}
        syncRootPreset={false}
      >
        {children}
      </LocaleBody>
    </html>
  )
}

async function RuntimeLocaleBody({ locale, children }: LocaleDocumentProps) {
  const runtimeData = await loadLocaleRuntimeData(locale)

  return (
    <LocaleBody
      {...runtimeData}
      locale={locale}
      syncRootPreset
    >
      {children}
    </LocaleBody>
  )
}

function RuntimeLocaleDocument({ locale, children }: LocaleDocumentProps) {
  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={openSauceOne.variable}
      suppressHydrationWarning
    >
      <Suspense fallback={null}>
        <RuntimeLocaleBody locale={locale}>
          {children}
        </RuntimeLocaleBody>
      </Suspense>
    </html>
  )
}

export default async function LocaleLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)

  return shouldPrerenderPublicShell()
    ? <PrerenderedLocaleDocument locale={locale}>{children}</PrerenderedLocaleDocument>
    : <RuntimeLocaleDocument locale={locale}>{children}</RuntimeLocaleDocument>
}
