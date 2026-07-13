import type { SportsVertical } from '@/lib/sports-vertical'

interface SportsMenuVerticalRow {
  id: string
}

const legacyEsportsGroupIdPattern = /^group-esports-\d+$/

function isEsportsMenuRow(row: SportsMenuVerticalRow) {
  return !legacyEsportsGroupIdPattern.test(row.id)
    && (row.id.startsWith('group-esports-') || row.id.startsWith('sidebar-esports-category-'))
}

export function isMenuRowForVertical(row: SportsMenuVerticalRow, vertical: SportsVertical) {
  return vertical === 'esports' ? isEsportsMenuRow(row) : !isEsportsMenuRow(row)
}
