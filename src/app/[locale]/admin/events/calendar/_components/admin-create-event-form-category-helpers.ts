import type { CategoryItem } from './admin-create-event-form-types'

function getCategorySlugKey(slug: string) {
  return slug.trim().toLowerCase()
}

export function buildCategorySlugSet(categories: CategoryItem[]) {
  return new Set(categories.map((category) => getCategorySlugKey(category.slug)).filter(Boolean))
}

export function mergeCategoryItems(primary: CategoryItem[], secondary: CategoryItem[]) {
  const bySlug = new Map<string, CategoryItem>()

  for (const item of [...primary, ...secondary]) {
    const label = item.label.trim()
    const slug = item.slug.trim()
    const slugKey = getCategorySlugKey(slug)
    if (!label || !slugKey || bySlug.has(slugKey)) {
      continue
    }

    bySlug.set(slugKey, { label, slug })
  }

  return Array.from(bySlug.values())
}

export function removeGeneratedCategoryItems(categories: CategoryItem[], generatedSlugs: Set<string>) {
  return categories.filter((category) => !generatedSlugs.has(getCategorySlugKey(category.slug)))
}
