'use client'

import { useMemo } from 'react'

import type { DataApiRewardAccount } from '@/lib/data-api/resolution-rewards'

import PublicResolutionsTable from './PublicResolutionsTable'

export default function PublicResolutionsList({
  resolutionAccount,
}: {
  resolutionAccount: DataApiRewardAccount | null
}) {
  const proposals = useMemo(
    () =>
      [...(resolutionAccount?.rewardProposals ?? [])].sort(
        (left, right) => Number(right.submittedAt) - Number(left.submittedAt),
      ),
    [resolutionAccount],
  )

  return <PublicResolutionsTable proposals={proposals} />
}
