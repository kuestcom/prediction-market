'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { renderHomePage } from '@/app/[locale]/(platform)/(home)/_lib/renderHomePage'
import { getCategorySeoTitle } from '@/lib/constants'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getCategorySeoTitle(MAIN_TAG_SLUG),
}

export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return renderHomePage({ locale, initialTag: MAIN_TAG_SLUG })
}
