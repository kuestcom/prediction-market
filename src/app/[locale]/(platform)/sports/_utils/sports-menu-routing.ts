import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'

type SportsMenuChildLinkEntry = Extract<SportsMenuEntry, { type: 'group' }>['links'][number]
type SportsMenuResolvedEntry = SportsMenuLinkEntry | SportsMenuGroupEntry | SportsMenuChildLinkEntry

function findSportsMenuEntryBySlug(params: {
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

function normalizeHrefPath(href: string) {
  const [path] = href.split(/[?#]/)
  return path?.replace(/\/+$/, '') || '/'
}

export function findSportsHrefBySlug(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
  excludeHref?: string
  hrefPrefix?: string
}) {
  const href = findSportsMenuEntryBySlug(params)?.href ?? null
  if (
    href
    && params.excludeHref
    && normalizeHrefPath(href) === normalizeHrefPath(params.excludeHref)
  ) {
    return null
  }

  return href
}
