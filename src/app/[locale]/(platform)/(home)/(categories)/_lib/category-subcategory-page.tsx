import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryPathSidebarSlug } from '@/lib/constants'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getCategorySeoTitle } from '@/lib/constants'
import { TagRepository } from '@/lib/db/queries/tag'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

interface CategorySubcategoryPageParams {
  params: Promise<{
    locale: string
    subcategory: string
  }>
}

interface CategorySubcategoryPageContentProps {
  category: CategoryPathSidebarSlug
  locale: string
  subcategory: string
}

async function getCategorySubcategoryData(
  locale: SupportedLocale,
  category: CategoryPathSidebarSlug,
  subcategory: string,
) {
  const { data: mainTags } = await TagRepository.getMainTags(locale)
  const activeCategory = mainTags?.find(tag => tag.slug === category)
  const activeSubcategory = activeCategory?.childs.find(child => child.slug === subcategory)

  if (!activeCategory || !activeSubcategory) {
    return null
  }

  return {
    categorySlug: category,
    subcategoryName: activeSubcategory.name,
    subcategorySlug: activeSubcategory.slug,
  }
}

export function createCategorySubcategoryMetadata(category: CategoryPathSidebarSlug) {
  return async function generateMetadata({ params }: CategorySubcategoryPageParams): Promise<Metadata> {
    const { locale, subcategory } = await params
    setRequestLocale(locale)

    if (subcategory === STATIC_PARAMS_PLACEHOLDER) {
      notFound()
    }

    const resolvedLocale = locale as SupportedLocale
    const categorySubcategoryData = await getCategorySubcategoryData(resolvedLocale, category, subcategory)

    if (!categorySubcategoryData) {
      notFound()
    }

    return {
      title: `${categorySubcategoryData.subcategoryName} | ${getCategorySeoTitle(categorySubcategoryData.categorySlug)}`,
    }
  }
}

export async function generateCategorySubcategoryStaticParams() {
  return [{ subcategory: STATIC_PARAMS_PLACEHOLDER }]
}

export async function CategorySubcategoryPageContent({
  category,
  locale,
  subcategory,
}: CategorySubcategoryPageContentProps) {
  if (subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const resolvedLocale = locale as SupportedLocale
  const categorySubcategoryData = await getCategorySubcategoryData(resolvedLocale, category, subcategory)

  if (!categorySubcategoryData) {
    notFound()
  }

  return (
    <HomeContent
      locale={locale}
      initialTag={categorySubcategoryData.subcategorySlug}
      initialMainTag={categorySubcategoryData.categorySlug}
    />
  )
}
