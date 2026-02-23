'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'

export const metadata: Metadata = {
  title: 'Sports',
}

export default async function SportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return <SportsContent locale={locale} />
}
