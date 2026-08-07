import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { formatCurrency } from '@/lib/formatters'

function fromBaseUnits(value: string) {
  try {
    return Number(BigInt(value)) / 1_000_000
  } catch {
    return 0
  }
}

function formatResolutionValue(value: number) {
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function resolveResolutionProposalValue(proposal: DataApiRewardProposal) {
  if (proposal.correct == null) {
    return { label: '—', positive: false }
  }
  if (proposal.correct) {
    const reward = fromBaseUnits(proposal.rewardAmount)
    return {
      label: reward > 0 ? `+${formatResolutionValue(reward)}` : formatResolutionValue(0),
      positive: reward > 0,
    }
  }

  return {
    label: `-${formatResolutionValue(fromBaseUnits(proposal.bondAmount))}`,
    positive: false,
  }
}
