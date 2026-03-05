'use cache'

import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  CategorySubcategoryPageContent,
  createCategorySubcategoryMetadata,
  generateCategorySubcategoryStaticParams,
} from '@/app/[locale]/(platform)/(home)/(categories)/_lib/category-subcategory-page'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

const CATEGORY_SLUG = 'climate-science' as const

export const generateMetadata = createCategorySubcategoryMetadata(CATEGORY_SLUG)

export const generateStaticParams = generateCategorySubcategoryStaticParams

export default async function ClimateScienceSubcategoryPage({
  params,
}: PageProps<'/[locale]/climate-science/[subcategory]'>) {
  const { locale, subcategory } = await params
  setRequestLocale(locale)

  if (subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return <CategorySubcategoryPageContent category={CATEGORY_SLUG} locale={locale} subcategory={subcategory} />
}
