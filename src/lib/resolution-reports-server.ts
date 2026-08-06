import type { DataApiPendingRewardReports } from '@/lib/data-api/resolution-rewards'

import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { fetchPendingResolutionRewardReports } from '@/lib/data-api/resolution-rewards'

export async function fetchAllowedCreatorResolutionReports(): Promise<DataApiPendingRewardReports> {
  const creators = await loadAllowedMarketCreatorWallets()
  if (creators.error || !creators.data) {
    throw new Error(creators.error ?? 'Could not load allowed market creators.')
  }
  return fetchPendingResolutionRewardReports(creators.data)
}

export function countResolutionReportsByCondition(reports: DataApiPendingRewardReports) {
  const counts = new Map<string, number>()
  for (const market of reports.rewardMarkets) {
    if (!market.conditionId) {
      continue
    }
    const count = Number(Boolean(market.noProposal)) + Number(Boolean(market.yesProposal))
    if (count > 0) {
      const conditionId = market.conditionId.toLowerCase()
      counts.set(conditionId, (counts.get(conditionId) ?? 0) + count)
    }
  }
  return counts
}
