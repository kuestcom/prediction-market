import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  return { title: t('Sports Upcoming') }
}

export default async function SportsSoonPage() {
  const t = await getExtracted()

  return (
    <SportsFeedPageContent sportSlug="soon" sportTitle={t('Upcoming Sports Games')} pageMode="soon" vertical="sports" />
  )
}
