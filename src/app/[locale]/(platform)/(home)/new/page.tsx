import type { Metadata } from 'next'

import { setRequestLocale } from 'next-intl/server'

import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import { getRootLocale } from '@/i18n/root-locale'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

export default async function NewPage() {
  setRequestLocale(await getRootLocale())

  return <HomeInitialContent initialTag={MAIN_TAG_SLUG} />
}
