import {
  LIQUIDITY_BPS_DENOMINATOR,
  LIQUIDITY_DEFAULT_SHARE_PRICE_MICRO,
  LIQUIDITY_MICRO_UNIT,
} from '@/lib/liquidity/constants'

export interface DepositPreview {
  navAmountMicro: bigint
  nextNavAmountMicro: bigint
  nextSharePriceMicro: bigint
  nextTotalSharesMicro: bigint
  shareAmountMicro: bigint
  sharePriceMicro: bigint
}

export interface NavComponents {
  allocatedAmountMicro?: bigint
  badDebtAmountMicro?: bigint
  feeAmountMicro?: bigint
  idleAmountMicro?: bigint
  openOrderAmountMicro?: bigint
  positionMarkAmountMicro?: bigint
  realizedPnlAmountMicro?: bigint
  rewardsAccruedAmountMicro?: bigint
  unrealizedPnlAmountMicro?: bigint
  withdrawalLiabilityAmountMicro?: bigint
}

export interface RewardAllocationInput {
  accountId: string
  weight: bigint
}

export interface RewardAllocation {
  accountId: string
  amountMicro: bigint
  weight: bigint
}

export interface StrategyLimitInput {
  navAmountMicro: bigint
  singleMarketCapBps: bigint | number
  singleOutcomeCapBps: bigint | number
  utilizationCapBps: bigint | number
}

export interface StrategyLimits {
  maxBotAllocationMicro: bigint
  maxSingleMarketAllocationMicro: bigint
  maxSingleOutcomeExposureMicro: bigint
}

export interface StrategyAllocationUsage {
  allocatedAmountMicro: bigint
  marketConditionId: string
  status: string
}

export interface StrategyAllocationCapitalDeltaInput {
  currentAllocatedAmountMicro?: bigint
  currentStatus?: string | null
  nextAllocatedAmountMicro: bigint
  nextStatus?: string | null
}

export interface StrategyAllocationCapitalDelta {
  allocationDeltaMicro: bigint
  currentActiveAllocatedAmountMicro: bigint
  nextActiveAllocatedAmountMicro: bigint
}

export interface WithdrawalPlanInput {
  idleAmountMicro: bigint
  idleBufferBps?: bigint | number
  navAmountMicro: bigint
  requestedAmountMicro?: bigint
  requestedSharesMicro?: bigint
  totalSharesMicro: bigint
  withdrawalLiabilityAmountMicro?: bigint
}

export interface WithdrawalPlan {
  assetsAmountMicro: bigint
  immediateAmountMicro: bigint
  queuedAmountMicro: bigint
  sharePriceMicro: bigint
  sharesToBurnMicro: bigint
}

export interface PrincipalBurnInput {
  positionPrincipalAmountMicro: bigint
  positionSharesMicro: bigint
  sharesToBurnMicro: bigint
}

function assertNonNegative(value: bigint, label: string) {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative.`)
  }
}

function assertPositive(value: bigint, label: string) {
  if (value <= 0n) {
    throw new Error(`${label} must be positive.`)
  }
}

function toBigIntValue(value: bigint | number | undefined, fallback: bigint) {
  if (value === undefined) {
    return fallback
  }
  return typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
}

function ceilDiv(numerator: bigint, denominator: bigint) {
  assertPositive(denominator, 'denominator')
  if (numerator <= 0n) {
    return 0n
  }
  return (numerator + denominator - 1n) / denominator
}

export function applyBps(value: bigint, bps: bigint | number) {
  const normalizedBps = toBigIntValue(bps, LIQUIDITY_BPS_DENOMINATOR)
  if (normalizedBps < 0n) {
    throw new Error('bps must be non-negative.')
  }
  return (value * normalizedBps) / LIQUIDITY_BPS_DENOMINATOR
}

export function calculateSharePriceMicro({
  navAmountMicro,
  totalSharesMicro,
}: {
  navAmountMicro: bigint
  totalSharesMicro: bigint
}) {
  assertNonNegative(navAmountMicro, 'navAmountMicro')
  assertNonNegative(totalSharesMicro, 'totalSharesMicro')

  if (totalSharesMicro === 0n || navAmountMicro === 0n) {
    return LIQUIDITY_DEFAULT_SHARE_PRICE_MICRO
  }

  return (navAmountMicro * LIQUIDITY_MICRO_UNIT) / totalSharesMicro
}

function calculateSharesForDeposit({
  depositAmountMicro,
  navAmountMicro,
  totalSharesMicro,
}: {
  depositAmountMicro: bigint
  navAmountMicro: bigint
  totalSharesMicro: bigint
}) {
  assertPositive(depositAmountMicro, 'depositAmountMicro')
  assertNonNegative(navAmountMicro, 'navAmountMicro')
  assertNonNegative(totalSharesMicro, 'totalSharesMicro')

  if (totalSharesMicro === 0n || navAmountMicro === 0n) {
    return depositAmountMicro
  }

  const shares = (depositAmountMicro * totalSharesMicro) / navAmountMicro
  assertPositive(shares, 'shareAmountMicro')
  return shares
}

export function calculateAssetsForShares({
  navAmountMicro,
  sharesMicro,
  totalSharesMicro,
}: {
  navAmountMicro: bigint
  sharesMicro: bigint
  totalSharesMicro: bigint
}) {
  assertNonNegative(navAmountMicro, 'navAmountMicro')
  assertPositive(totalSharesMicro, 'totalSharesMicro')
  assertNonNegative(sharesMicro, 'sharesMicro')

  if (sharesMicro === 0n || navAmountMicro === 0n) {
    return 0n
  }

  return (sharesMicro * navAmountMicro) / totalSharesMicro
}

export function previewDeposit({
  depositAmountMicro,
  navAmountMicro,
  totalSharesMicro,
}: {
  depositAmountMicro: bigint
  navAmountMicro: bigint
  totalSharesMicro: bigint
}): DepositPreview {
  const shareAmountMicro = calculateSharesForDeposit({
    depositAmountMicro,
    navAmountMicro,
    totalSharesMicro,
  })
  const nextNavAmountMicro = navAmountMicro + depositAmountMicro
  const nextTotalSharesMicro = totalSharesMicro + shareAmountMicro

  return {
    navAmountMicro,
    nextNavAmountMicro,
    nextSharePriceMicro: calculateSharePriceMicro({
      navAmountMicro: nextNavAmountMicro,
      totalSharesMicro: nextTotalSharesMicro,
    }),
    nextTotalSharesMicro,
    shareAmountMicro,
    sharePriceMicro: calculateSharePriceMicro({ navAmountMicro, totalSharesMicro }),
  }
}

export function calculateNavAmountMicro(components: NavComponents) {
  const navAmountMicro = (
    (components.idleAmountMicro ?? 0n)
    + (components.allocatedAmountMicro ?? 0n)
    + (components.openOrderAmountMicro ?? 0n)
    + (components.positionMarkAmountMicro ?? 0n)
    + (components.rewardsAccruedAmountMicro ?? 0n)
    + (components.realizedPnlAmountMicro ?? 0n)
    + (components.unrealizedPnlAmountMicro ?? 0n)
    - (components.feeAmountMicro ?? 0n)
    - (components.badDebtAmountMicro ?? 0n)
    - (components.withdrawalLiabilityAmountMicro ?? 0n)
  )

  return navAmountMicro > 0n ? navAmountMicro : 0n
}

export function calculateImmediateWithdrawalCapacity({
  idleAmountMicro,
  idleBufferBps = 0,
  navAmountMicro,
  withdrawalLiabilityAmountMicro = 0n,
}: {
  idleAmountMicro: bigint
  idleBufferBps?: bigint | number
  navAmountMicro: bigint
  withdrawalLiabilityAmountMicro?: bigint
}) {
  assertNonNegative(idleAmountMicro, 'idleAmountMicro')
  assertNonNegative(navAmountMicro, 'navAmountMicro')
  assertNonNegative(withdrawalLiabilityAmountMicro, 'withdrawalLiabilityAmountMicro')

  const reservedIdle = applyBps(navAmountMicro, idleBufferBps) + withdrawalLiabilityAmountMicro
  return idleAmountMicro > reservedIdle ? idleAmountMicro - reservedIdle : 0n
}

export function planWithdrawal(input: WithdrawalPlanInput): WithdrawalPlan {
  const hasAmount = input.requestedAmountMicro !== undefined
  const hasShares = input.requestedSharesMicro !== undefined
  if (hasAmount === hasShares) {
    throw new Error('Provide exactly one withdrawal target.')
  }

  assertPositive(input.navAmountMicro, 'navAmountMicro')
  assertPositive(input.totalSharesMicro, 'totalSharesMicro')
  assertNonNegative(input.idleAmountMicro, 'idleAmountMicro')

  const sharePriceMicro = calculateSharePriceMicro(input)
  const sharesToBurnMicro = hasShares
    ? input.requestedSharesMicro!
    : ceilDiv(input.requestedAmountMicro! * input.totalSharesMicro, input.navAmountMicro)
  assertPositive(sharesToBurnMicro, 'sharesToBurnMicro')

  const assetsAmountMicro = calculateAssetsForShares({
    navAmountMicro: input.navAmountMicro,
    sharesMicro: sharesToBurnMicro,
    totalSharesMicro: input.totalSharesMicro,
  })
  const capacity = calculateImmediateWithdrawalCapacity({
    idleAmountMicro: input.idleAmountMicro,
    idleBufferBps: input.idleBufferBps,
    navAmountMicro: input.navAmountMicro,
    withdrawalLiabilityAmountMicro: input.withdrawalLiabilityAmountMicro,
  })
  const immediateAmountMicro = assetsAmountMicro < capacity ? assetsAmountMicro : capacity

  return {
    assetsAmountMicro,
    immediateAmountMicro,
    queuedAmountMicro: assetsAmountMicro - immediateAmountMicro,
    sharePriceMicro,
    sharesToBurnMicro,
  }
}

export function calculatePrincipalForShareBurn({
  positionPrincipalAmountMicro,
  positionSharesMicro,
  sharesToBurnMicro,
}: PrincipalBurnInput) {
  assertNonNegative(positionPrincipalAmountMicro, 'positionPrincipalAmountMicro')
  assertPositive(positionSharesMicro, 'positionSharesMicro')
  assertNonNegative(sharesToBurnMicro, 'sharesToBurnMicro')

  if (sharesToBurnMicro === 0n) {
    return 0n
  }
  if (sharesToBurnMicro >= positionSharesMicro) {
    return positionPrincipalAmountMicro
  }

  return (positionPrincipalAmountMicro * sharesToBurnMicro) / positionSharesMicro
}

export function calculateStrategyLimits(input: StrategyLimitInput): StrategyLimits {
  assertNonNegative(input.navAmountMicro, 'navAmountMicro')

  return {
    maxBotAllocationMicro: applyBps(input.navAmountMicro, input.utilizationCapBps),
    maxSingleMarketAllocationMicro: applyBps(input.navAmountMicro, input.singleMarketCapBps),
    maxSingleOutcomeExposureMicro: applyBps(input.navAmountMicro, input.singleOutcomeCapBps),
  }
}

export function calculateNextActiveStrategyAllocationTotal({
  existingAllocations,
  marketConditionId,
  nextAllocatedAmountMicro,
  nextStatus = 'active',
}: {
  existingAllocations: StrategyAllocationUsage[]
  marketConditionId: string
  nextAllocatedAmountMicro: bigint
  nextStatus?: string
}) {
  assertNonNegative(nextAllocatedAmountMicro, 'nextAllocatedAmountMicro')
  const activeAllocationTotalExcludingCurrent = existingAllocations
    .filter(allocation => allocation.status === 'active' && allocation.marketConditionId !== marketConditionId)
    .reduce((sum, allocation) => sum + allocation.allocatedAmountMicro, 0n)

  return nextStatus === 'active'
    ? activeAllocationTotalExcludingCurrent + nextAllocatedAmountMicro
    : activeAllocationTotalExcludingCurrent
}

export function calculateStrategyAllocationCapitalDelta({
  currentAllocatedAmountMicro = 0n,
  currentStatus = 'active',
  nextAllocatedAmountMicro,
  nextStatus = 'active',
}: StrategyAllocationCapitalDeltaInput): StrategyAllocationCapitalDelta {
  assertNonNegative(currentAllocatedAmountMicro, 'currentAllocatedAmountMicro')
  assertNonNegative(nextAllocatedAmountMicro, 'nextAllocatedAmountMicro')

  const currentActiveAllocatedAmountMicro = currentStatus === 'active'
    ? currentAllocatedAmountMicro
    : 0n
  const nextActiveAllocatedAmountMicro = nextStatus === 'active'
    ? nextAllocatedAmountMicro
    : 0n

  return {
    allocationDeltaMicro: nextActiveAllocatedAmountMicro - currentActiveAllocatedAmountMicro,
    currentActiveAllocatedAmountMicro,
    nextActiveAllocatedAmountMicro,
  }
}

export function allocateRewards({
  totalRewardMicro,
  weights,
}: {
  totalRewardMicro: bigint
  weights: RewardAllocationInput[]
}): RewardAllocation[] {
  assertNonNegative(totalRewardMicro, 'totalRewardMicro')
  const positiveWeights = weights.filter(entry => entry.weight > 0n)
  const totalWeight = positiveWeights.reduce((sum, entry) => sum + entry.weight, 0n)

  if (totalRewardMicro === 0n || totalWeight === 0n) {
    return weights.map(entry => ({
      accountId: entry.accountId,
      amountMicro: 0n,
      weight: entry.weight,
    }))
  }

  const allocations = weights.map((entry, index) => {
    const weightedAmount = totalRewardMicro * (entry.weight > 0n ? entry.weight : 0n)
    return {
      accountId: entry.accountId,
      amountMicro: weightedAmount / totalWeight,
      index,
      remainder: weightedAmount % totalWeight,
      weight: entry.weight,
    }
  })

  let allocated = allocations.reduce((sum, entry) => sum + entry.amountMicro, 0n)
  let remaining = totalRewardMicro - allocated
  const remainderOrder = [...allocations]
    .filter(entry => entry.weight > 0n)
    .sort((a, b) => {
      if (a.remainder === b.remainder) {
        return a.index - b.index
      }
      return a.remainder > b.remainder ? -1 : 1
    })

  for (const entry of remainderOrder) {
    if (remaining <= 0n) {
      break
    }
    allocations[entry.index]!.amountMicro += 1n
    remaining -= 1n
  }

  allocated = allocations.reduce((sum, entry) => sum + entry.amountMicro, 0n)
  if (allocated !== totalRewardMicro) {
    throw new Error('Reward allocation invariant failed.')
  }

  return allocations.map(({ accountId, amountMicro, weight }) => ({
    accountId,
    amountMicro,
    weight,
  }))
}
