'use cache'

import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import PwaServiceWorker from '@/components/PwaServiceWorker'
import TestModeBanner from '@/components/TestModeBanner'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { routing } from '@/i18n/routing'
import { cacheTags } from '@/lib/cache-tags'
import { openSauceOne } from '@/lib/fonts'
import { IS_TEST_MODE } from '@/lib/network'
import { resolvePwaThemeColors } from '@/lib/pwa-colors'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import SiteIdentityProvider from '@/providers/SiteIdentityProvider'
import '../globals.css'

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

  return {
    title: {
      template: `%s | ${site.name}`,
      default: `${site.name} | ${site.description}`,
    },
    description: site.description,
    applicationName: site.name,
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
  cacheTag(cacheTags.settings)

  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      className={`${openSauceOne.variable}`}
      data-theme-preset={runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        <PwaServiceWorker />
        {runtimeTheme.theme.cssText && <style id="theme-vars" dangerouslySetInnerHTML={{ __html: runtimeTheme.theme.cssText }} />}
        <SiteIdentityProvider site={runtimeTheme.site}>
          <NextIntlClientProvider locale={locale}>
            {IS_TEST_MODE && <TestModeBanner />}
            {children}
          </NextIntlClientProvider>
        </SiteIdentityProvider>
      </body>
    </html>
  )
}
