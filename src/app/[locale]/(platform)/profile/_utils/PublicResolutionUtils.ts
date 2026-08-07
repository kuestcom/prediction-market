import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { formatCurrency } from '@/lib/formatters'
import { resolutionRewardBaseUnitsToNumber } from '@/lib/resolution-reward-amounts'

function formatResolutionValue(value: number) {
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 6 })
}

export function resolveResolutionProposalValue(proposal: DataApiRewardProposal) {
  if (proposal.correct == null) {
    return { label: '—', positive: false }
  }
  if (proposal.correct) {
    const reward = resolutionRewardBaseUnitsToNumber(proposal.rewardAmount)
    return {
      label: reward > 0 ? `+${formatResolutionValue(reward)}` : formatResolutionValue(0),
      positive: reward > 0,
    }
  }

  const bond = resolutionRewardBaseUnitsToNumber(proposal.bondAmount)
  return { label: bond > 0 ? `-${formatResolutionValue(bond)}` : formatResolutionValue(0), positive: false }
}
