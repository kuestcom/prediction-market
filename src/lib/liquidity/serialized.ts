export interface SerializedLiquidityLabPool {
  activeStrategyAllocations: Array<{
    allocatedAmountMicro: string
    currentExposureAmountMicro: string
    marketConditionId: string
    marketSlug: string | null
    usedAmountMicro: string
  }>
  allocatedAmountMicro: string
  badDebtAmountMicro: string
  categorySlug: string
  feeAmountMicro: string
  id: string
  idleAmountMicro: string
  idleBufferBps: number
  name: string
  navAmountMicro: string
  openOrderAmountMicro: string
  positionMarkAmountMicro: string
  realizedPnlAmountMicro: string
  rewardsAccruedAmountMicro: string
  riskTier: string
  singleMarketCapBps: number
  singleOutcomeCapBps: number
  slug: string
  status: string
  totalSharesMicro: string
  unrealizedPnlAmountMicro: string
  userPrincipalAmountMicro: string
  userSharesMicro: string
  utilizationCapBps: number
  withdrawalLiabilityAmountMicro: string
}

export interface SerializedLiquidityWithdrawalRequest {
  assetsAmountMicro: string
  claimableAt: string
  completedAt: string | null
  createdAt: string
  id: string
  immediateAmountMicro: string
  poolId: string
  queuedAmountMicro: string
  requestedAmountMicro: string | null
  requestedAt: string
  sharePriceMicro: string
  sharesToBurnMicro: string
  status: string
}

export function serializeMicroAmount(value: bigint | null | undefined) {
  return (value ?? 0n).toString()
}
