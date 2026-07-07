import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'

export const metadata: Metadata = {
  title: 'Esports Upcoming',
}

export default async function EsportsSoonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <SportsFeedPageContent
      locale={locale as SupportedLocale}
      sportSlug="soon"
      sportTitle="Upcoming Esports Games"
      pageMode="soon"
      vertical="esports"
    />
  )
}
