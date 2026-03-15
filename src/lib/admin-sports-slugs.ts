import type { SportsMenuEntry } from '@/lib/sports-menu-types'

export interface AdminSportsSlugOption {
  label: string
  value: string
}

export interface AdminSportsSlugCatalog {
  sportOptions: AdminSportsSlugOption[]
  leagueOptionsBySport: Record<string, AdminSportsSlugOption[]>
  allLeagueOptions: AdminSportsSlugOption[]
}

export const EMPTY_ADMIN_SPORTS_SLUG_CATALOG: AdminSportsSlugCatalog = {
  sportOptions: [],
  leagueOptionsBySport: {},
  allLeagueOptions: [],
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pushUniqueOption(target: AdminSportsSlugOption[], option: AdminSportsSlugOption) {
  if (!option.label || !option.value) {
    return
  }

  if (target.some(item => item.value === option.value)) {
    return
  }

  target.push(option)
}

export function buildAdminSportsSlugCatalog(menuEntries: SportsMenuEntry[]): AdminSportsSlugCatalog {
  const sportOptions: AdminSportsSlugOption[] = []
  const allLeagueOptions: AdminSportsSlugOption[] = []
  const leagueOptionsBySport = new Map<string, AdminSportsSlugOption[]>()

  for (const entry of menuEntries) {
    if (entry.type === 'group') {
      const sportValue = slugify(entry.label)
      if (!sportValue) {
        continue
      }

      pushUniqueOption(sportOptions, {
        label: entry.label,
        value: sportValue,
      })

      const groupLeagueOptions: AdminSportsSlugOption[] = []
      entry.links.forEach((link) => {
        const leagueValue = link.menuSlug?.trim().toLowerCase() || slugify(link.label)
        const option = {
          label: link.label,
          value: leagueValue,
        }

        pushUniqueOption(groupLeagueOptions, option)
        pushUniqueOption(allLeagueOptions, option)
      })

      leagueOptionsBySport.set(sportValue, groupLeagueOptions)
      continue
    }

    if (entry.type !== 'link') {
      continue
    }

    const value = entry.menuSlug?.trim().toLowerCase() || slugify(entry.label)
    if (!value) {
      continue
    }

    const option = {
      label: entry.label,
      value,
    }

    pushUniqueOption(sportOptions, option)
    pushUniqueOption(allLeagueOptions, option)
    leagueOptionsBySport.set(value, [option])
  }

  return {
    sportOptions,
    leagueOptionsBySport: Object.fromEntries(leagueOptionsBySport),
    allLeagueOptions,
  }
}
