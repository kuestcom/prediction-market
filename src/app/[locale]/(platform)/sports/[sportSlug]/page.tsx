import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { normalizeSportsSlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ sportSlug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsBySportRedirectPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string }>
}) {
  const { locale, sportSlug } = await params
  setRequestLocale(locale)
  if (sportSlug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const normalizedSportSlug = normalizeSportsSlug(sportSlug) || 'sports'
  redirect(`/sports/${normalizedSportSlug}/games` as never)
}
