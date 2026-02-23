'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { renderHomePage } from '@/app/[locale]/(platform)/(home)/_lib/renderHomePage'
import { getCategorySeoTitle } from '@/lib/constants'

const CATEGORY_SLUG = 'tech' as const

export const metadata: Metadata = {
  title: getCategorySeoTitle(CATEGORY_SLUG),
}

export default async function CategoryPage({ params }: PageProps<'/[locale]/tech'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return renderHomePage({ locale, initialTag: CATEGORY_SLUG })
}
