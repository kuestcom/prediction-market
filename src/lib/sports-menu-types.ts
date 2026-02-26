export interface SportsMenuDividerEntry {
  type: 'divider'
  id: string
}

export interface SportsMenuHeaderEntry {
  type: 'header'
  id: string
  label: string
}

export interface SportsMenuLinkEntry {
  type: 'link'
  id: string
  label: string
  href: string
  iconPath: string
  menuSlug: string | null
}

export interface SportsMenuGroupEntry {
  type: 'group'
  id: string
  label: string
  iconPath: string
  links: SportsMenuLinkEntry[]
}

export type SportsMenuEntry = SportsMenuDividerEntry
  | SportsMenuHeaderEntry
  | SportsMenuLinkEntry
  | SportsMenuGroupEntry
