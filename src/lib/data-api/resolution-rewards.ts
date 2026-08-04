import { buildDataApiUrl } from '@/lib/data-api/client'

export interface DataApiRewardProposal {
  id: string
  market: { id: string }
  wallet: string
  side: number
  status: string
  submittedAt: string
  withdrawalRequestedAt: string | null
  withdrawalAvailableAt: string | null
}

export interface DataApiRewardMarket {
  id: string
  token: string
  bond: string
  rewardPool: string
  rewardBps: number
  lockDuration: string
  withdrawalDelay: string
  status: string
  noProposal: DataApiRewardProposal | null
  yesProposal: DataApiRewardProposal | null
}

export async function fetchResolutionRewardMarket(marketId: string): Promise<DataApiRewardMarket | null> {
  const response = await fetch(buildDataApiUrl(`/v1/resolution-rewards/markets/${marketId}`), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API reward market request failed (${response.status}).`)
  }

  const payload = (await response.json()) as { rewardMarket?: DataApiRewardMarket | null }
  return payload.rewardMarket ?? null
}

export async function fetchResolutionRewardAccountProposals(wallet: string): Promise<DataApiRewardProposal[]> {
  const response = await fetch(buildDataApiUrl(`/v1/resolution-rewards/accounts/${wallet}`), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API reward account request failed (${response.status}).`)
  }

  const payload = (await response.json()) as { rewardProposals?: DataApiRewardProposal[] }
  return payload.rewardProposals ?? []
}
