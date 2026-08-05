import { setRequestLocale } from 'next-intl/server'

import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import { getRootLocale } from '@/i18n/root-locale'

export const instant = false

export default async function HomePage() {
  setRequestLocale(await getRootLocale())

  return <HomeInitialContent />
}
