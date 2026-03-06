'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent locale={locale} initialTag={MAIN_TAG_SLUG} />
}
