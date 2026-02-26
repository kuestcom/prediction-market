import type { SupportedLocale } from '@/i18n/locales'
import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

function findSportsHrefBySlug(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
}) {
  const { menuEntries, canonicalSportSlug } = params
  if (!menuEntries) {
    return null
  }

  for (const entry of menuEntries) {
    if (entry.type === 'link' && entry.menuSlug === canonicalSportSlug) {
      return entry.href
    }

    if (entry.type === 'group') {
      const link = entry.links.find(child => child.menuSlug === canonicalSportSlug)
      if (link) {
        return link.href
      }
    }
  }

  return null
}

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

  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData(),
  ])

  if (!canonicalSportSlug) {
    notFound()
  }

  const sportHref = findSportsHrefBySlug({
    menuEntries: layoutData?.menuEntries,
    canonicalSportSlug,
  })

  if (!sportHref) {
    notFound()
  }

  redirect({
    href: sportHref,
    locale: locale as SupportedLocale,
  })
}
