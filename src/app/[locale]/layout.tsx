'use cache'

import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import TestModeBanner from '@/components/TestModeBanner'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { routing } from '@/i18n/routing'
import { cacheTags } from '@/lib/cache-tags'
import { openSauceOne } from '@/lib/fonts'
import { IS_TEST_MODE } from '@/lib/network'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import SiteIdentityProvider from '@/providers/SiteIdentityProvider'
import '../globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const runtimeTheme = await loadRuntimeThemeState()
  const site = runtimeTheme.site

  return {
    title: {
      template: `${site.name} | %s`,
      default: `${site.name} | ${site.description}`,
    },
    description: site.description,
    applicationName: site.name,
    icons: {
      icon: site.logoUrl,
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
}

export async function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
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
