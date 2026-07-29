'use client'

import type { SportsEventQuerySelection } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'

import { useSportsEventQuerySync } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-hooks'

function SportsEventQuerySync({
  onSelectionChange,
}: {
  onSelectionChange: (selection: SportsEventQuerySelection) => void
}) {
  useSportsEventQuerySync(onSelectionChange)

  return null
}

export default SportsEventQuerySync
