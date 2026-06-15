export interface OpeningShareBalance {
  accountId: string
  sharesMicro: bigint
}

export interface ShareBalanceChange {
  accountId: string
  at: Date
  shareDeltaMicro: bigint
}

export interface ShareTimeWeight {
  accountId: string
  shareSeconds: bigint
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

function addToMap(map: Map<string, bigint>, key: string, value: bigint) {
  map.set(key, (map.get(key) ?? 0n) + value)
}

function applyShareDelta(balances: Map<string, bigint>, change: ShareBalanceChange) {
  const nextBalance = (balances.get(change.accountId) ?? 0n) + change.shareDeltaMicro
  if (nextBalance < 0n) {
    throw new Error(`Share balance for ${change.accountId} cannot become negative.`)
  }
  balances.set(change.accountId, nextBalance)
}

function accrueShareSeconds({
  balances,
  durationSeconds,
  weights,
}: {
  balances: Map<string, bigint>
  durationSeconds: bigint
  weights: Map<string, bigint>
}) {
  if (durationSeconds <= 0n) {
    return
  }

  for (const [accountId, sharesMicro] of balances.entries()) {
    if (sharesMicro > 0n) {
      addToMap(weights, accountId, sharesMicro * durationSeconds)
    }
  }
}

export function calculateShareTimeWeights({
  changes,
  openingBalances,
  periodEnd,
  periodStart,
}: {
  changes: ShareBalanceChange[]
  openingBalances: OpeningShareBalance[]
  periodEnd: Date
  periodStart: Date
}): ShareTimeWeight[] {
  const startSeconds = toUnixSeconds(periodStart)
  const endSeconds = toUnixSeconds(periodEnd)
  if (endSeconds <= startSeconds) {
    throw new Error('periodEnd must be after periodStart.')
  }

  const balances = new Map<string, bigint>()
  const weights = new Map<string, bigint>()
  for (const balance of openingBalances) {
    if (balance.sharesMicro < 0n) {
      throw new Error(`Opening share balance for ${balance.accountId} cannot be negative.`)
    }
    balances.set(balance.accountId, balance.sharesMicro)
    weights.set(balance.accountId, 0n)
  }

  const sortedChanges = [...changes].sort((a, b) => a.at.getTime() - b.at.getTime())
  let cursorSeconds = startSeconds

  for (const change of sortedChanges) {
    const changeSeconds = toUnixSeconds(change.at)
    if (changeSeconds <= startSeconds) {
      applyShareDelta(balances, change)
      weights.set(change.accountId, weights.get(change.accountId) ?? 0n)
      continue
    }
    if (changeSeconds >= endSeconds) {
      break
    }

    accrueShareSeconds({
      balances,
      durationSeconds: BigInt(changeSeconds - cursorSeconds),
      weights,
    })
    applyShareDelta(balances, change)
    weights.set(change.accountId, weights.get(change.accountId) ?? 0n)
    cursorSeconds = changeSeconds
  }

  accrueShareSeconds({
    balances,
    durationSeconds: BigInt(endSeconds - cursorSeconds),
    weights,
  })

  return Array.from(weights.entries())
    .map(([accountId, shareSeconds]) => ({ accountId, shareSeconds }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId))
}
