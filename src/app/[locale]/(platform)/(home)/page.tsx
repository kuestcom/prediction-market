import { setRequestLocale } from 'next-intl/server'
import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import { resolveSupportedLocale } from '@/i18n/locales'

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = resolveSupportedLocale(locale)
  setRequestLocale(resolvedLocale)

  return <HomeInitialContent locale={resolvedLocale} />
}
