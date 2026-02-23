'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'

export const metadata: Metadata = {
  title: 'Sports Live',
}

export default async function SportsLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <SportsContent
      locale={locale}
      initialTag="sports"
      initialMode="live"
      selectedTitle="Live"
    />
  )
}
