import { setRequestLocale } from 'next-intl/server'
import { locale } from 'next/root-params'
import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import { resolveSupportedLocale } from '@/i18n/locales'

export default async function HomePage() {
  const resolvedLocale = resolveSupportedLocale(await locale())
  setRequestLocale(resolvedLocale)

  return <HomeInitialContent locale={resolvedLocale} />
}
