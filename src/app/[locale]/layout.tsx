'use cache'

import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import TestModeBanner from '@/components/TestModeBanner'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { routing } from '@/i18n/routing'
import { openSauceOne } from '@/lib/fonts'
import { IS_TEST_MODE } from '@/lib/network'
import { svgLogoUri } from '@/lib/utils'
import '../globals.css'

const siteIcon = svgLogoUri()

export const metadata: Metadata = {
  title: {
    template: `${process.env.NEXT_PUBLIC_SITE_NAME} | %s`,
    default: `${process.env.NEXT_PUBLIC_SITE_NAME} | ${process.env.NEXT_PUBLIC_SITE_DESCRIPTION}`,
  },
  description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
  applicationName: process.env.NEXT_PUBLIC_SITE_NAME,
  icons: {
    icon: siteIcon,
  },
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

  setRequestLocale(locale)

  return (
    <html lang={locale} className={`${openSauceOne.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider locale={locale}>
          {IS_TEST_MODE && <TestModeBanner />}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
