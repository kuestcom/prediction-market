'use cache'

import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import CustomJavascriptCode from '@/components/CustomJavascriptCode'
import GlobalAnnouncementBanner from '@/components/GlobalAnnouncementBanner'
import PwaInstallStateSync from '@/components/PwaInstallStateSync'
import PwaServiceWorker from '@/components/PwaServiceWorker'
import SiteStructuredData from '@/components/seo/SiteStructuredData'
import TestModeBannerDeferred from '@/components/TestModeBannerDeferred'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { routing } from '@/i18n/routing'
import { cacheTags } from '@/lib/cache-tags'
import { openSauceOne } from '@/lib/fonts'
import { loadGlobalAnnouncementSettings } from '@/lib/global-announcement-settings'
import { IS_TEST_MODE } from '@/lib/network'
import { resolvePwaThemeColors } from '@/lib/pwa-colors'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import { AppProviders } from '@/providers/AppProviders'
import SiteIdentityProvider from '@/providers/SiteIdentityProvider'

const { resolveSiteUrl } = siteUrlUtils

export async function generateViewport(): Promise<Viewport> {
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

export default async function LocaleLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const enabledLocales = await loadEnabledLocales()
  if (!enabledLocales.includes(locale)) {
    notFound()
  }

  const runtimeTheme = await loadRuntimeThemeState()
  const globalAnnouncement = await loadGlobalAnnouncementSettings()
  const hasGlobalAnnouncement = globalAnnouncement.message.trim().length > 0
  cacheTag(cacheTags.settings)

  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      className={openSauceOne.variable}
      data-theme-preset={runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        <SiteStructuredData locale={locale} site={runtimeTheme.site} />
        <PwaServiceWorker />
        {runtimeTheme.theme.cssText && <style id="theme-vars" dangerouslySetInnerHTML={{ __html: runtimeTheme.theme.cssText }} />}
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
              {IS_TEST_MODE && <TestModeBannerDeferred />}
              <PwaInstallStateSync />
              {children}
              <CustomJavascriptCode locale={locale} codes={runtimeTheme.site.customJavascriptCodes} />
            </AppProviders>
          </NextIntlClientProvider>
        </SiteIdentityProvider>
      </body>
    </html>
  )
}
