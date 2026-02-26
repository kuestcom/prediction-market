import type { ReactNode } from 'react'
import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { openSauceOne } from '@/lib/fonts'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import './globals.css'

interface Props {
  children: ReactNode
  params: Promise<{ locale?: string }>
}

export default async function RootLayout({ children, params }: Props) {
  const { locale: requestedLocale } = await params
  const locale = hasLocale(routing.locales, requestedLocale) ? requestedLocale : routing.defaultLocale
  const runtimeTheme = await loadRuntimeThemeState()

  return (
    <html
      lang={locale}
      className={openSauceOne.variable}
      data-theme-preset={runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        {children}
      </body>
    </html>
  )
}
