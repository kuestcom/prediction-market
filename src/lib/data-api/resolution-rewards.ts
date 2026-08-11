import { buildDataApiUrl } from '@/lib/data-api/client'

export interface DataApiRewardProposal {
  id: string
  proposalId: string
  market: {
    id: string
    adapter: string | null
    questionId: string | null
    lockDuration: string
    conditionId: string | null
    title: string
    marketSlug: string
    icon: string
    eventSlug: string
    eventTitle: string
    eventIcon: string
    eventSeriesSlug: string | null
    yesLabel?: string
    noLabel?: string
  }
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
  profile: {
    username: string
    avatarUrl: string
  }
  history: {
    correct: string
    incorrect: string
  }
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
  adapter: string | null
  questionId: string | null
  conditionId: string | null
  title: string
  marketSlug: string
  icon: string
  eventSlug: string
  eventTitle: string
  eventIcon: string
  eventSeriesSlug: string | null
  creator: string
  token: string
  bond: string
  rewardPool: string
  rewardBps: number
  lockDuration: string
  withdrawalDelay: string
  registeredAt: string
  status: string
  resolvedAt: string | null
  rewardAmount: string
  noProposal: DataApiRewardProposal | null
  yesProposal: DataApiRewardProposal | null
}

export interface DataApiPendingRewardReports {
  totalCount: number
  rewardMarkets: DataApiRewardMarket[]
}

const REPORT_CREATORS_PER_REQUEST = 50

async function fetchPendingResolutionRewardReportBatch(creators: string[]): Promise<DataApiPendingRewardReports> {
  const searchParams = new URLSearchParams({
    creators: creators.join(','),
    limit: '500',
  })
  const response = await fetch(buildDataApiUrl('/v1/resolution-rewards/reports', searchParams), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API pending resolution reports request failed (${response.status}).`)
  }
  const payload = (await response.json()) as Partial<DataApiPendingRewardReports>
  const result = {
    totalCount: Number(payload.totalCount ?? 0),
    rewardMarkets: payload.rewardMarkets ?? [],
  }
  const loadedProposalCount = result.rewardMarkets.reduce(
    (total, market) => total + Number(Boolean(market.noProposal)) + Number(Boolean(market.yesProposal)),
    0,
  )
  if (loadedProposalCount >= result.totalCount) {
    return result
  }
  if (creators.length === 1) {
    throw new Error(`Data API pending resolution reports were truncated for creator ${creators[0]}.`)
  }

  const midpoint = Math.ceil(creators.length / 2)
  const batches = await Promise.all([
    fetchPendingResolutionRewardReportBatch(creators.slice(0, midpoint)),
    fetchPendingResolutionRewardReportBatch(creators.slice(midpoint)),
  ])
  return {
    totalCount: batches.reduce((total, batch) => total + batch.totalCount, 0),
    rewardMarkets: batches.flatMap((batch) => batch.rewardMarkets),
  }
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

export async function fetchResolutionRewardAccount(
  wallet: string,
  options: { signal?: AbortSignal } = {},
): Promise<DataApiRewardAccount> {
  const response = await fetch(buildDataApiUrl(`/v1/resolution-rewards/accounts/${wallet}`), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: options.signal,
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

export async function fetchPendingResolutionRewardReports(creators: string[]): Promise<DataApiPendingRewardReports> {
  const normalizedCreators = Array.from(
    new Set(creators.map((creator) => creator.trim().toLowerCase()).filter(Boolean)),
  ).sort()
  if (normalizedCreators.length === 0) {
    return { totalCount: 0, rewardMarkets: [] }
  }

  const requests: Array<Promise<DataApiPendingRewardReports>> = []
  for (let offset = 0; offset < normalizedCreators.length; offset += REPORT_CREATORS_PER_REQUEST) {
    const creatorBatch = normalizedCreators.slice(offset, offset + REPORT_CREATORS_PER_REQUEST)
    requests.push(fetchPendingResolutionRewardReportBatch(creatorBatch))
  }

  const batches = await Promise.all(requests)
  const marketsById = new Map<string, DataApiRewardMarket>()
  for (const batch of batches) {
    for (const market of batch.rewardMarkets) {
      marketsById.set(market.id.toLowerCase(), market)
    }
  }

  return {
    totalCount: batches.reduce((total, batch) => total + batch.totalCount, 0),
    rewardMarkets: [...marketsById.values()].sort(
      (left, right) => Number(right.registeredAt) - Number(left.registeredAt),
    ),
  }
}
