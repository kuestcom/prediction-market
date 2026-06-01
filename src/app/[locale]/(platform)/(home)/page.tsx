import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale

  return <HomeInitialContent locale={resolvedLocale} />
}
