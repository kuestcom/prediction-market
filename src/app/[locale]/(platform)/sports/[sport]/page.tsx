import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'
import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { getPublicShellStaticParams, shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER })
}

export default async function SportsBySportRedirectPage({
  params,
}: PageProps<'/[locale]/sports/[sport]'>) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(sport)) {
      return null
    }
    notFound()
  }

  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData('sports'),
  ])

  if (!canonicalSportSlug) {
    notFound()
  }

  const sportHref = findSportsHrefBySlug({
    menuEntries: layoutData?.menuEntries,
    canonicalSportSlug,
    excludeHref: `/sports/${canonicalSportSlug}`,
  })

  if (!sportHref) {
    notFound()
  }

  redirect({
    href: sportHref,
    locale: locale as SupportedLocale,
  })
}
