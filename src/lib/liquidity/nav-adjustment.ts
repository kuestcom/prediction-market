import { calculateNavAmountMicro, calculateSharePriceMicro } from './math'

export interface PoolNavState {
  allocatedAmountMicro: bigint
  badDebtAmountMicro: bigint
  feeAmountMicro: bigint
  idleAmountMicro: bigint
  navAmountMicro: bigint
  openOrderAmountMicro: bigint
  positionMarkAmountMicro: bigint
  realizedPnlAmountMicro: bigint
  rewardsAccruedAmountMicro: bigint
  totalSharesMicro: bigint
  unrealizedPnlAmountMicro: bigint
  withdrawalLiabilityAmountMicro: bigint
}

export interface PoolNavDelta {
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

export interface PoolNavAdjustment {
  amountDeltaMicro: bigint
  next: PoolNavState & {
    sharePriceMicro: bigint
  }
  previous: PoolNavState
}

function applyDelta({
  allowNegative = false,
  current,
  delta,
  label,
}: {
  allowNegative?: boolean
  current: bigint
  delta?: bigint
  label: string
}) {
  const next = current + (delta ?? 0n)
  if (!allowNegative && next < 0n) {
    throw new Error(`${label} cannot become negative.`)
  }

  return next
}

export function applyPoolNavDelta({
  delta,
  state,
}: {
  delta: PoolNavDelta
  state: PoolNavState
}): PoolNavAdjustment {
  const nextWithoutNav = {
    allocatedAmountMicro: applyDelta({
      current: state.allocatedAmountMicro,
      delta: delta.allocatedAmountMicro,
      label: 'allocatedAmountMicro',
    }),
    badDebtAmountMicro: applyDelta({
      current: state.badDebtAmountMicro,
      delta: delta.badDebtAmountMicro,
      label: 'badDebtAmountMicro',
    }),
    feeAmountMicro: applyDelta({
      current: state.feeAmountMicro,
      delta: delta.feeAmountMicro,
      label: 'feeAmountMicro',
    }),
    idleAmountMicro: applyDelta({
      current: state.idleAmountMicro,
      delta: delta.idleAmountMicro,
      label: 'idleAmountMicro',
    }),
    openOrderAmountMicro: applyDelta({
      current: state.openOrderAmountMicro,
      delta: delta.openOrderAmountMicro,
      label: 'openOrderAmountMicro',
    }),
    positionMarkAmountMicro: applyDelta({
      current: state.positionMarkAmountMicro,
      delta: delta.positionMarkAmountMicro,
      label: 'positionMarkAmountMicro',
    }),
    realizedPnlAmountMicro: applyDelta({
      allowNegative: true,
      current: state.realizedPnlAmountMicro,
      delta: delta.realizedPnlAmountMicro,
      label: 'realizedPnlAmountMicro',
    }),
    rewardsAccruedAmountMicro: applyDelta({
      current: state.rewardsAccruedAmountMicro,
      delta: delta.rewardsAccruedAmountMicro,
      label: 'rewardsAccruedAmountMicro',
    }),
    totalSharesMicro: state.totalSharesMicro,
    unrealizedPnlAmountMicro: applyDelta({
      allowNegative: true,
      current: state.unrealizedPnlAmountMicro,
      delta: delta.unrealizedPnlAmountMicro,
      label: 'unrealizedPnlAmountMicro',
    }),
    withdrawalLiabilityAmountMicro: applyDelta({
      current: state.withdrawalLiabilityAmountMicro,
      delta: delta.withdrawalLiabilityAmountMicro,
      label: 'withdrawalLiabilityAmountMicro',
    }),
  }
  const navAmountMicro = calculateNavAmountMicro({
    allocatedAmountMicro: nextWithoutNav.allocatedAmountMicro,
    badDebtAmountMicro: nextWithoutNav.badDebtAmountMicro,
    feeAmountMicro: nextWithoutNav.feeAmountMicro,
    idleAmountMicro: nextWithoutNav.idleAmountMicro,
    openOrderAmountMicro: nextWithoutNav.openOrderAmountMicro,
    positionMarkAmountMicro: nextWithoutNav.positionMarkAmountMicro,
    realizedPnlAmountMicro: nextWithoutNav.realizedPnlAmountMicro,
    rewardsAccruedAmountMicro: nextWithoutNav.rewardsAccruedAmountMicro,
    unrealizedPnlAmountMicro: nextWithoutNav.unrealizedPnlAmountMicro,
    withdrawalLiabilityAmountMicro: nextWithoutNav.withdrawalLiabilityAmountMicro,
  })

  return {
    amountDeltaMicro: navAmountMicro - state.navAmountMicro,
    next: {
      ...nextWithoutNav,
      navAmountMicro,
      sharePriceMicro: calculateSharePriceMicro({
        navAmountMicro,
        totalSharesMicro: state.totalSharesMicro,
      }),
    },
    previous: state,
  }
}
