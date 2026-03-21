export const HIDE_FROM_NEW_TAG_SLUG = 'hide-from-new'

export function hasHiddenFromPublicListsTag(
  tagsOrSlugs: Array<string | null | undefined | { slug?: string | null }> | null | undefined,
) {
  if (!tagsOrSlugs || tagsOrSlugs.length === 0) {
    return false
  }

  return tagsOrSlugs.some((entry) => {
    const slug = typeof entry === 'string' ? entry : entry?.slug
    return slug?.trim().toLowerCase() === HIDE_FROM_NEW_TAG_SLUG
  })
}
