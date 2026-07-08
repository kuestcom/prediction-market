import type {
  CategoryItem,
  CategorySuggestion,
  FormState,
  MainCategory,
} from './admin-create-event-form-types'
import { useMemo } from 'react'
import {
  buildCategorySlugSet,
  removeGeneratedCategoryItems,
} from './admin-create-event-form-category-helpers'
import { extractTitleCategorySuggestions } from './admin-create-event-form-utils'

export function useCategorySuggestions({
  categoryQuery,
  form,
  globalCategories,
  selectedMainCategory,
  sportsDerivedCategories,
}: {
  categoryQuery: string
  form: FormState
  globalCategories: CategorySuggestion[]
  selectedMainCategory: MainCategory | null
  sportsDerivedCategories: CategoryItem[]
}) {
  const titleCategorySuggestions = useMemo(
    () => extractTitleCategorySuggestions(form.title),
    [form.title],
  )

  const categorySuggestionsPool = useMemo(() => {
    const source = selectedMainCategory?.childs?.length
      ? selectedMainCategory.childs
      : globalCategories

    const sourceHead = source.slice(0, 4)
    const sourceTail = source.slice(4)
    const ordered = [...sourceHead, ...titleCategorySuggestions, ...sourceTail]

    const bySlug = new Map<string, CategorySuggestion>()
    ordered.forEach((item) => {
      if (!bySlug.has(item.slug)) {
        bySlug.set(item.slug, item)
      }
    })

    return Array.from(bySlug.values())
  }, [globalCategories, selectedMainCategory, titleCategorySuggestions])

  const filteredCategorySuggestions = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    const selectedSlugs = new Set(form.categories.map(category => category.slug))

    return categorySuggestionsPool
      .filter((item) => {
        if (selectedSlugs.has(item.slug)) {
          return false
        }

        if (!query) {
          return true
        }

        return item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query)
      })
      .slice(0, 10)
  }, [categoryQuery, categorySuggestionsPool, form.categories])

  const selectedCategoryChips = useMemo(() => {
    const chips = [...form.categories]
    if (!selectedMainCategory) {
      return chips
    }

    const exists = chips.some(category => category.slug === selectedMainCategory.slug)
    if (!exists) {
      return [{ label: selectedMainCategory.name, slug: selectedMainCategory.slug }, ...chips]
    }

    return chips
  }, [form.categories, selectedMainCategory])
  const sportsGeneratedCategorySlugs = useMemo(
    () => buildCategorySlugSet(sportsDerivedCategories),
    [sportsDerivedCategories],
  )
  const sportsCustomCategoryChips = useMemo(
    () => removeGeneratedCategoryItems(form.categories, sportsGeneratedCategorySlugs),
    [form.categories, sportsGeneratedCategorySlugs],
  )

  return {
    titleCategorySuggestions,
    filteredCategorySuggestions,
    selectedCategoryChips,
    sportsGeneratedCategorySlugs,
    sportsCustomCategoryChips,
  }
}
