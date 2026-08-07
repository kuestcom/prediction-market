import 'server-only'
import type { DataApiRewardAccount } from '@/lib/data-api/resolution-rewards'

import { fetchResolutionRewardAccount } from '@/lib/data-api/resolution-rewards'
import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'

export async function hydrateResolutionRewardAccount(
  account: DataApiRewardAccount | null,
): Promise<DataApiRewardAccount | null> {
  if (!account) {
    return null
  }

  const localMarkets = await ResolutionReportContextRepository.getMarketsByConditionIds(
    account.rewardProposals.flatMap((proposal) => (proposal.market.conditionId ? [proposal.market.conditionId] : [])),
  )
  const localMarketByCondition = new Map(localMarkets.map((market) => [market.conditionId, market]))

  return {
    ...account,
    rewardProposals: account.rewardProposals.map((proposal) => {
      const localMarket = proposal.market.conditionId
        ? localMarketByCondition.get(proposal.market.conditionId.toLowerCase())
        : null

      return {
        ...proposal,
        market: localMarket
          ? { ...proposal.market, ...localMarket }
          : { ...proposal.market, icon: '', eventIcon: '', yesLabel: 'YES', noLabel: 'NO' },
      }
    }),
  }
}

export async function fetchDisplayResolutionRewardAccount(wallet: string): Promise<DataApiRewardAccount | null> {
  const account = await fetchResolutionRewardAccount(wallet)
  return hydrateResolutionRewardAccount(account)
}
