import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'

export default async function SportsBySportRedirectPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string }>
}) {
  const { locale, sportSlug } = await params
  setRequestLocale(locale)

  const normalizedSportSlug = normalizeSportsSlug(sportSlug) || 'sports'
  redirect(`/sports/${normalizedSportSlug}/games` as never)
}
