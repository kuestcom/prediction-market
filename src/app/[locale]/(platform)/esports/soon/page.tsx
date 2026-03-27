'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'

export const metadata: Metadata = {
  title: 'Esports Upcoming',
}

export default async function EsportsSoonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="grid gap-4">
      <SportsContent
        locale={locale}
        initialTag="esports"
        mainTag="esports"
        initialMode="futures"
      />
    </div>
  )
}
