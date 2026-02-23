'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getCategorySeoTitle } from '@/lib/constants'

const CATEGORY_SLUG = 'economy' as const

export const metadata: Metadata = {
  title: getCategorySeoTitle(CATEGORY_SLUG),
}

export default async function CategoryPage({ params }: PageProps<'/[locale]/economy'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent locale={locale} initialTag={CATEGORY_SLUG} />
}
