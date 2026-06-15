export interface LiquidityClaimablePoolLiquidity {
  existingClaimableQueuedAmountMicro?: bigint
  idleAmountMicro: bigint
  poolId: string
}

export interface LiquidityClaimableWithdrawalCandidate {
  claimableAt: Date
  id: string
  poolId: string
  queuedAmountMicro: bigint
  requestedAt: Date
}

export interface LiquidityClaimableSelection {
  remainingIdleByPool: Map<string, bigint>
  selectedIds: string[]
}

function compareDate(a: Date, b: Date) {
  return a.getTime() - b.getTime()
}

export function selectLiquidityClaimableWithdrawalIds({
  candidates,
  poolLiquidity,
}: {
  candidates: LiquidityClaimableWithdrawalCandidate[]
  poolLiquidity: LiquidityClaimablePoolLiquidity[]
}): LiquidityClaimableSelection {
  const remainingIdleByPool = new Map<string, bigint>()
  for (const pool of poolLiquidity) {
    const existingClaimableQueuedAmountMicro = pool.existingClaimableQueuedAmountMicro ?? 0n
    const remainingIdle = pool.idleAmountMicro > existingClaimableQueuedAmountMicro
      ? pool.idleAmountMicro - existingClaimableQueuedAmountMicro
      : 0n
    remainingIdleByPool.set(pool.poolId, remainingIdle)
  }

  const selectedIds: string[] = []
  const orderedCandidates = [...candidates].sort((a, b) => (
    compareDate(a.claimableAt, b.claimableAt)
    || compareDate(a.requestedAt, b.requestedAt)
    || a.id.localeCompare(b.id)
  ))

  for (const candidate of orderedCandidates) {
    const remainingIdle = remainingIdleByPool.get(candidate.poolId) ?? 0n
    if (candidate.queuedAmountMicro > remainingIdle) {
      continue
    }

    selectedIds.push(candidate.id)
    remainingIdleByPool.set(candidate.poolId, remainingIdle - candidate.queuedAmountMicro)
  }

  return {
    remainingIdleByPool,
    selectedIds,
  }
}
