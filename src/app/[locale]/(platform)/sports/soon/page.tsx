import type { Metadata } from 'next'

import { setRequestLocale } from 'next-intl/server'

import SportsFeedPageContent from '@/app/[locale]/(platform)/sports/_components/SportsFeedPageContent'
import { getRootLocale } from '@/i18n/root-locale'

export const metadata: Metadata = {
  title: 'Sports Upcoming',
}

export default async function SportsSoonPage() {
  setRequestLocale(await getRootLocale())

  return <SportsFeedPageContent sportSlug="soon" sportTitle="Upcoming Sports Games" pageMode="soon" vertical="sports" />
}
