'use cache'

import { setRequestLocale } from 'next-intl/server'
import { renderHomePage } from '@/app/[locale]/(platform)/(home)/_lib/renderHomePage'

export default async function CategoryPage({ params }: PageProps<'/[locale]/climate-science'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return renderHomePage({ locale, initialTag: 'climate-science' })
}
