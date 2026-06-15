import type { OpeningShareBalance, ShareBalanceChange } from '@/lib/liquidity/share-time'
import { allocateRewards, applyBps } from '@/lib/liquidity/math'
import { calculateShareTimeWeights } from '@/lib/liquidity/share-time'

interface ShareLedgerEntry {
  accountId: string
  at: Date
  shareDeltaMicro: bigint
}

interface RewardPeriodParticipant {
  accountId: string
  lockMultiplierBps?: bigint | number
}

interface RewardPeriodAllocation {
  accountId: string
  rewardAmountMicro: bigint
  rewardPoints: bigint
  rewardWeight: bigint
  shareSeconds: bigint
}

interface RewardPeriodInput {
  ledgerEntries: ShareLedgerEntry[]
  participants?: RewardPeriodParticipant[]
  periodEnd: Date
  periodStart: Date
  poolMultiplierBps?: bigint | number
  totalRewardMicro: bigint
  totalRewardPoints?: bigint
  utilizationMultiplierBps?: bigint | number
}

interface ShareTimeInputs {
  changes: ShareBalanceChange[]
  openingBalances: OpeningShareBalance[]
}

function toUnixMs(date: Date) {
  return date.getTime()
}

function addToBalance(balances: Map<string, bigint>, entry: ShareLedgerEntry) {
  const nextBalance = (balances.get(entry.accountId) ?? 0n) + entry.shareDeltaMicro
  if (nextBalance < 0n) {
    throw new Error(`Opening share balance for ${entry.accountId} cannot become negative.`)
  }
  balances.set(entry.accountId, nextBalance)
}

function getMultiplierForAccount(
  accountId: string,
  participantsByAccountId: Map<string, RewardPeriodParticipant>,
) {
  return participantsByAccountId.get(accountId)?.lockMultiplierBps ?? 10_000
}

function prepareShareTimeInputsFromLedger({
  ledgerEntries,
  periodEnd,
  periodStart,
}: {
  ledgerEntries: ShareLedgerEntry[]
  periodEnd: Date
  periodStart: Date
}): ShareTimeInputs {
  if (toUnixMs(periodEnd) <= toUnixMs(periodStart)) {
    throw new Error('periodEnd must be after periodStart.')
  }

  const openingBalances = new Map<string, bigint>()
  const changes: ShareBalanceChange[] = []
  const startMs = toUnixMs(periodStart)
  const endMs = toUnixMs(periodEnd)

  for (const entry of [...ledgerEntries].sort((a, b) => toUnixMs(a.at) - toUnixMs(b.at))) {
    const entryMs = toUnixMs(entry.at)
    if (entryMs <= startMs) {
      addToBalance(openingBalances, entry)
      continue
    }
    if (entryMs >= endMs) {
      continue
    }

    changes.push({
      accountId: entry.accountId,
      at: entry.at,
      shareDeltaMicro: entry.shareDeltaMicro,
    })
    if (!openingBalances.has(entry.accountId)) {
      openingBalances.set(entry.accountId, 0n)
    }
  }

  return {
    changes,
    openingBalances: Array.from(openingBalances.entries())
      .map(([accountId, sharesMicro]) => ({ accountId, sharesMicro }))
      .sort((a, b) => a.accountId.localeCompare(b.accountId)),
  }
}

export function calculateRewardPeriodAllocations({
  ledgerEntries,
  participants = [],
  periodEnd,
  periodStart,
  poolMultiplierBps = 10_000,
  totalRewardMicro,
  totalRewardPoints = 0n,
  utilizationMultiplierBps = 10_000,
}: RewardPeriodInput): RewardPeriodAllocation[] {
  const participantsByAccountId = new Map(participants.map(participant => [participant.accountId, participant]))
  const shareTimeInputs = prepareShareTimeInputsFromLedger({
    ledgerEntries,
    periodEnd,
    periodStart,
  })
  const shareTimeWeights = calculateShareTimeWeights({
    ...shareTimeInputs,
    periodEnd,
    periodStart,
  })
  const weightedEntries = shareTimeWeights.map(({ accountId, shareSeconds }) => {
    const lockMultiplierBps = getMultiplierForAccount(accountId, participantsByAccountId)
    let rewardWeight = applyBps(shareSeconds, lockMultiplierBps)
    rewardWeight = applyBps(rewardWeight, poolMultiplierBps)
    rewardWeight = applyBps(rewardWeight, utilizationMultiplierBps)

    return {
      accountId,
      rewardWeight,
      shareSeconds,
    }
  })

  const rewardAmounts = allocateRewards({
    totalRewardMicro,
    weights: weightedEntries.map(entry => ({
      accountId: entry.accountId,
      weight: entry.rewardWeight,
    })),
  })
  const rewardPoints = allocateRewards({
    totalRewardMicro: totalRewardPoints,
    weights: weightedEntries.map(entry => ({
      accountId: entry.accountId,
      weight: entry.rewardWeight,
    })),
  })
  const amountByAccountId = new Map(rewardAmounts.map(allocation => [allocation.accountId, allocation.amountMicro]))
  const pointsByAccountId = new Map(rewardPoints.map(allocation => [allocation.accountId, allocation.amountMicro]))

  return weightedEntries.map(entry => ({
    accountId: entry.accountId,
    rewardAmountMicro: amountByAccountId.get(entry.accountId) ?? 0n,
    rewardPoints: pointsByAccountId.get(entry.accountId) ?? 0n,
    rewardWeight: entry.rewardWeight,
    shareSeconds: entry.shareSeconds,
  }))
}
