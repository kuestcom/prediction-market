import type { Metadata } from 'next'

import { setRequestLocale } from 'next-intl/server'

import type { SupportedLocale } from '@/i18n/locales'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'

export const metadata: Metadata = {
  title: 'Sports Upcoming',
}

export default async function SportsSoonPage({ params }: PageProps<'/[locale]/sports/soon'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <SportsFeedPageContent
      locale={locale as SupportedLocale}
      sportSlug="soon"
      sportTitle="Upcoming Sports Games"
      pageMode="soon"
      vertical="sports"
    />
  )
}
