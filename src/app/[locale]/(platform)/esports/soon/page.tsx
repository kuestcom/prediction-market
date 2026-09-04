import type { Metadata } from 'next'

import { getExtracted, setRequestLocale } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { getRootLocale } from '@/i18n/root-locale'

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(await getRootLocale())
  const t = await getExtracted()

  return { title: t('Esports Upcoming') }
}

export default async function EsportsSoonPage() {
  setRequestLocale(await getRootLocale())
  const t = await getExtracted()

  return (
    <SportsFeedPageContent
      sportSlug="soon"
      sportTitle={t('Upcoming Esports Games')}
      pageMode="soon"
      vertical="esports"
    />
  )
}
