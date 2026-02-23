import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import { redirect } from '@/i18n/navigation'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsBySportRedirectPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string }>
}) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const normalizedSportSlug = normalizeSportsSlug(sport) || 'sports'
  redirect({
    href: `/sports/${normalizedSportSlug}/games`,
    locale: locale as SupportedLocale,
  })
}
