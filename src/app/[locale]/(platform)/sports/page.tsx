'use cache'

import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'

import type { SupportedLocale } from '@/i18n/locales'

import { redirect } from '@/i18n/navigation'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  return { title: t('Sports') }
}

export default async function SportsPage({ params }: PageProps<'/[locale]/sports'>) {
  const { locale } = await params
  const { data: landingHref } = await SportsMenuRepository.getLandingHref('sports')

  redirect({
    href: landingHref?.trim() || '/sports/live',
    locale: locale as SupportedLocale,
  })
}
