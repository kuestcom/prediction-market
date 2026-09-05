import type { Metadata } from 'next'

import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

export default async function NewPage() {
  return <HomeInitialContent initialTag={MAIN_TAG_SLUG} />
}
