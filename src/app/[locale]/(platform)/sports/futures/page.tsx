import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function SportsFuturesRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect({
    href: '/sports/futures/nba',
    locale: locale as SupportedLocale,
  })
}
