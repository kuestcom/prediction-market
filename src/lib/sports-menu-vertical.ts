import type { SportsVertical } from '@/lib/sports-vertical'

interface SportsMenuVerticalRow {
  id: string
}

function isEsportsMenuRow(row: SportsMenuVerticalRow) {
  return row.id !== 'group-esports-13'
    && (row.id.startsWith('group-esports-') || row.id.startsWith('sidebar-esports-category-'))
}

export function isMenuRowForVertical(row: SportsMenuVerticalRow, vertical: SportsVertical) {
  return vertical === 'esports' ? isEsportsMenuRow(row) : !isEsportsMenuRow(row)
}
