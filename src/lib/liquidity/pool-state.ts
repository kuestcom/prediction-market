import {
  applyBps,
  calculateAssetsForShares,
  calculateImmediateWithdrawalCapacity,
  calculateSharePriceMicro,
  calculateStrategyLimits,
} from './math'

export interface PoolStateInput {
  allocatedAmountMicro: bigint
  idleAmountMicro: bigint
  idleBufferBps: bigint | number
  navAmountMicro: bigint
  singleMarketCapBps: bigint | number
  singleOutcomeCapBps: bigint | number
  totalSharesMicro: bigint
  utilizationCapBps: bigint | number
  withdrawalLiabilityAmountMicro?: bigint
  activeStrategyAllocations?: Array<{
    allocatedAmountMicro: bigint
    currentExposureAmountMicro?: bigint
    usedAmountMicro?: bigint
  }>
  userPosition?: {
    principalAmountMicro: bigint
    sharesMicro: bigint
  } | null
}

export interface PoolState {
  activeAllocatedAmountMicro: bigint
  activeExposureAmountMicro: bigint
  activeUsedAmountMicro: bigint
  allocatedAmountMicro: bigint
  availableBotCapacityMicro: bigint
  idleAmountMicro: bigint
  idleBufferTargetMicro: bigint
  immediateWithdrawalCapacityMicro: bigint
  maxBotAllocationMicro: bigint
  maxSingleMarketAllocationMicro: bigint
  maxSingleOutcomeExposureMicro: bigint
  navAmountMicro: bigint
  sharePriceMicro: bigint
  totalSharesMicro: bigint
  utilizationBps: bigint
  userAssetsMicro: bigint
  userOwnershipBps: bigint
  userPnlMicro: bigint
  withdrawalLiabilityAmountMicro: bigint
}

function assertNonNegative(value: bigint, label: string) {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative.`)
  }
}

function calculateBps(numerator: bigint, denominator: bigint) {
  if (numerator <= 0n || denominator <= 0n) {
    return 0n
  }

  return (numerator * 10_000n) / denominator
}

export function calculatePoolState(input: PoolStateInput): PoolState {
  assertNonNegative(input.navAmountMicro, 'navAmountMicro')
  assertNonNegative(input.totalSharesMicro, 'totalSharesMicro')
  assertNonNegative(input.idleAmountMicro, 'idleAmountMicro')
  assertNonNegative(input.allocatedAmountMicro, 'allocatedAmountMicro')
  assertNonNegative(input.withdrawalLiabilityAmountMicro ?? 0n, 'withdrawalLiabilityAmountMicro')

  const activeStrategyAllocations = input.activeStrategyAllocations ?? []
  for (const allocation of activeStrategyAllocations) {
    assertNonNegative(allocation.allocatedAmountMicro, 'activeStrategyAllocation.allocatedAmountMicro')
    assertNonNegative(allocation.usedAmountMicro ?? 0n, 'activeStrategyAllocation.usedAmountMicro')
    assertNonNegative(allocation.currentExposureAmountMicro ?? 0n, 'activeStrategyAllocation.currentExposureAmountMicro')
  }

  const activeAllocatedAmountMicro = activeStrategyAllocations.reduce(
    (sum, allocation) => sum + allocation.allocatedAmountMicro,
    0n,
  )
  const activeUsedAmountMicro = activeStrategyAllocations.reduce(
    (sum, allocation) => sum + (allocation.usedAmountMicro ?? 0n),
    0n,
  )
  const activeExposureAmountMicro = activeStrategyAllocations.reduce(
    (sum, allocation) => sum + (allocation.currentExposureAmountMicro ?? 0n),
    0n,
  )

  assertNonNegative(activeAllocatedAmountMicro, 'activeAllocatedAmountMicro')
  assertNonNegative(activeUsedAmountMicro, 'activeUsedAmountMicro')
  assertNonNegative(activeExposureAmountMicro, 'activeExposureAmountMicro')

  const strategyLimits = calculateStrategyLimits({
    navAmountMicro: input.navAmountMicro,
    singleMarketCapBps: input.singleMarketCapBps,
    singleOutcomeCapBps: input.singleOutcomeCapBps,
    utilizationCapBps: input.utilizationCapBps,
  })
  const availableBotCapacityMicro = strategyLimits.maxBotAllocationMicro > activeAllocatedAmountMicro
    ? strategyLimits.maxBotAllocationMicro - activeAllocatedAmountMicro
    : 0n
  const userSharesMicro = input.userPosition?.sharesMicro ?? 0n
  const userAssetsMicro = input.userPosition && userSharesMicro > 0n && input.totalSharesMicro > 0n
    ? calculateAssetsForShares({
        navAmountMicro: input.navAmountMicro,
        sharesMicro: userSharesMicro,
        totalSharesMicro: input.totalSharesMicro,
      })
    : 0n

  return {
    activeAllocatedAmountMicro,
    activeExposureAmountMicro,
    activeUsedAmountMicro,
    allocatedAmountMicro: input.allocatedAmountMicro,
    availableBotCapacityMicro,
    idleAmountMicro: input.idleAmountMicro,
    idleBufferTargetMicro: applyBps(input.navAmountMicro, input.idleBufferBps),
    immediateWithdrawalCapacityMicro: calculateImmediateWithdrawalCapacity({
      idleAmountMicro: input.idleAmountMicro,
      idleBufferBps: input.idleBufferBps,
      navAmountMicro: input.navAmountMicro,
      withdrawalLiabilityAmountMicro: input.withdrawalLiabilityAmountMicro,
    }),
    maxBotAllocationMicro: strategyLimits.maxBotAllocationMicro,
    maxSingleMarketAllocationMicro: strategyLimits.maxSingleMarketAllocationMicro,
    maxSingleOutcomeExposureMicro: strategyLimits.maxSingleOutcomeExposureMicro,
    navAmountMicro: input.navAmountMicro,
    sharePriceMicro: calculateSharePriceMicro({
      navAmountMicro: input.navAmountMicro,
      totalSharesMicro: input.totalSharesMicro,
    }),
    totalSharesMicro: input.totalSharesMicro,
    utilizationBps: calculateBps(activeAllocatedAmountMicro, input.navAmountMicro),
    userAssetsMicro,
    userOwnershipBps: calculateBps(userSharesMicro, input.totalSharesMicro),
    userPnlMicro: userAssetsMicro - (input.userPosition?.principalAmountMicro ?? 0n),
    withdrawalLiabilityAmountMicro: input.withdrawalLiabilityAmountMicro ?? 0n,
  }
}
