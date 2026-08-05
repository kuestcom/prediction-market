import { buildDataApiUrl } from '@/lib/data-api/client'

export interface DataApiRewardProposal {
  id: string
  proposalId: string
  market: { id: string }
  creator: string
  wallet: string
  side: number
  status: string
  submittedAt: string
  withdrawalRequestedAt: string | null
  withdrawalAvailableAt: string | null
  correct: boolean | null
  rewardEligible: boolean
  bondBeneficiary: string | null
  bondAmount: string
  rewardAmount: string
  transactionHash: string
}

export interface DataApiRewardAccountStats {
  id: string
  proposals: string
  correct: string
  incorrect: string
  refunds: string
  withdrawals: string
  totalBondCredited: string
  totalRewardCredited: string
}

interface DataApiRewardClaim {
  id: string
  token: string
  beneficiary: string
  amount: string
  timestamp: string
  transactionHash: string
}

export interface DataApiRewardAccount {
  rewardAccountStats: DataApiRewardAccountStats | null
  rewardProposals: DataApiRewardProposal[]
  rewardClaims: DataApiRewardClaim[]
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
  resolvedAt: string | null
  rewardAmount: string
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
  const account = await fetchResolutionRewardAccount(wallet)
  return account.rewardProposals
}

export async function fetchResolutionRewardAccount(wallet: string): Promise<DataApiRewardAccount> {
  const response = await fetch(buildDataApiUrl(`/v1/resolution-rewards/accounts/${wallet}`), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API reward account request failed (${response.status}).`)
  }

  const payload = (await response.json()) as Partial<DataApiRewardAccount>
  return {
    rewardAccountStats: payload.rewardAccountStats ?? null,
    rewardProposals: payload.rewardProposals ?? [],
    rewardClaims: payload.rewardClaims ?? [],
  }
}
