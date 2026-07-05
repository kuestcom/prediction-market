'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export const metadata: Metadata = {
  title: 'Esports',
}

export default async function EsportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  redirect({
    href: '/esports/live',
    locale: locale as SupportedLocale,
  })
}
