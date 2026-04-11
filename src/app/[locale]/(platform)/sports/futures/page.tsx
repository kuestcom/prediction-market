import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export default async function SportsFuturesRedirectPage({
  params,
}: PageProps<'/[locale]/sports/futures'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const { data: futuresHref } = await SportsMenuRepository.getFuturesHref('sports')
  if (!futuresHref) {
    notFound()
  }

  redirect({
    href: futuresHref,
    locale: locale as SupportedLocale,
  })
}
