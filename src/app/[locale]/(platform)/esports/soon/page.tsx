import type { Metadata } from 'next'

import { setRequestLocale } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { getRootLocale } from '@/i18n/root-locale'

export const metadata: Metadata = {
  title: 'Esports Upcoming',
}

export default async function EsportsSoonPage() {
  setRequestLocale(await getRootLocale())

  return (
    <SportsFeedPageContent sportSlug="soon" sportTitle="Upcoming Esports Games" pageMode="soon" vertical="esports" />
  )
}
