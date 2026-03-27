import type { SportsMenuEntry, SportsMenuLinkEntry } from '@/lib/sports-menu-types'

type SportsMenuChildLinkEntry = Extract<SportsMenuEntry, { type: 'group' }>['links'][number]

export function findSportsMenuEntryBySlug(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
}): SportsMenuLinkEntry | SportsMenuChildLinkEntry | null {
  const { menuEntries, canonicalSportSlug } = params
  if (!menuEntries) {
    return null
  }

  for (const entry of menuEntries) {
    if (entry.type === 'link' && entry.menuSlug === canonicalSportSlug) {
      return entry
    }

    if (entry.type === 'group') {
      const link = entry.links.find(child => child.menuSlug === canonicalSportSlug)
      if (link) {
        return link
      }
    }
  }

  return null
}

export function findSportsHrefBySlug(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
}) {
  return findSportsMenuEntryBySlug(params)?.href ?? null
}
