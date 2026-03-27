import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'

type SportsMenuChildLinkEntry = Extract<SportsMenuEntry, { type: 'group' }>['links'][number]
type SportsMenuResolvedEntry = SportsMenuLinkEntry | SportsMenuGroupEntry | SportsMenuChildLinkEntry

export function findSportsMenuEntryBySlug(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
  hrefPrefix?: string
}): SportsMenuResolvedEntry | null {
  const { menuEntries, canonicalSportSlug, hrefPrefix } = params
  if (!menuEntries) {
    return null
  }

  for (const entry of menuEntries) {
    if (
      entry.type === 'link'
      && entry.menuSlug === canonicalSportSlug
      && (!hrefPrefix || entry.href.startsWith(hrefPrefix))
    ) {
      return entry
    }

    if (entry.type === 'group') {
      if (entry.menuSlug === canonicalSportSlug && (!hrefPrefix || entry.href.startsWith(hrefPrefix))) {
        return entry
      }

      const link = entry.links.find(child =>
        child.menuSlug === canonicalSportSlug
        && (!hrefPrefix || child.href.startsWith(hrefPrefix)),
      )
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
  hrefPrefix?: string
}) {
  return findSportsMenuEntryBySlug(params)?.href ?? null
}
