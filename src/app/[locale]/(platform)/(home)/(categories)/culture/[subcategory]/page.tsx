'use cache'

import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  CategorySubcategoryPageContent,
  createCategorySubcategoryMetadata,
  generateCategorySubcategoryStaticParams,
} from '@/app/[locale]/(platform)/(home)/(categories)/_lib/category-subcategory-page'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

const CATEGORY_SLUG = 'culture' as const

export const generateMetadata = createCategorySubcategoryMetadata(CATEGORY_SLUG)

export const generateStaticParams = generateCategorySubcategoryStaticParams

export default async function CultureSubcategoryPage({ params }: PageProps<'/[locale]/culture/[subcategory]'>) {
  const { locale, subcategory } = await params
  setRequestLocale(locale)

  if (subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return <CategorySubcategoryPageContent category={CATEGORY_SLUG} locale={locale} subcategory={subcategory} />
}
