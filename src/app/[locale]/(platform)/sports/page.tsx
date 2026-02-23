'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sports',
}

export default async function SportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect('/sports/live')
}
