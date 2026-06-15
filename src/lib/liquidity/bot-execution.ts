export interface ReserveLiquidityBotOrderInput {
  allocatedAmountMicro: bigint
  allocationLimitAmountMicro: bigint
  openOrderAmountMicro: bigint
  reserveAmountMicro: bigint
  usedAmountMicro: bigint
}

export interface ReserveLiquidityBotOrderResult {
  nextAllocatedAmountMicro: bigint
  nextOpenOrderAmountMicro: bigint
  nextUsedAmountMicro: bigint
}

export interface FillLiquidityBotOrderInput {
  allocatedAmountMicro: bigint
  filledAmountMicro: bigint
  openOrderAmountMicro: bigint
  positionMarkAmountMicro: bigint
  positionMarkDeltaMicro?: bigint
  reservedAmountMicro: bigint
  usedAmountMicro: bigint
}

export interface FillLiquidityBotOrderResult {
  releasedAmountMicro: bigint
  nextAllocatedAmountMicro: bigint
  nextOpenOrderAmountMicro: bigint
  nextPositionMarkAmountMicro: bigint
  nextUsedAmountMicro: bigint
}

export interface ReleaseLiquidityBotOrderInput {
  allocatedAmountMicro: bigint
  openOrderAmountMicro: bigint
  releaseAmountMicro: bigint
  usedAmountMicro: bigint
}

export interface ReleaseLiquidityBotOrderResult {
  nextAllocatedAmountMicro: bigint
  nextOpenOrderAmountMicro: bigint
  nextUsedAmountMicro: bigint
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

export function reserveLiquidityBotOrder(
  input: ReserveLiquidityBotOrderInput,
): ReserveLiquidityBotOrderResult {
  assertPositive(input.reserveAmountMicro, 'reserveAmountMicro')
  assertNonNegative(input.allocatedAmountMicro, 'allocatedAmountMicro')
  assertNonNegative(input.openOrderAmountMicro, 'openOrderAmountMicro')
  assertNonNegative(input.usedAmountMicro, 'usedAmountMicro')
  assertNonNegative(input.allocationLimitAmountMicro, 'allocationLimitAmountMicro')

  if (input.reserveAmountMicro > input.allocatedAmountMicro) {
    throw new Error('Bot order reserve exceeds available allocated capital.')
  }
  if (input.usedAmountMicro + input.reserveAmountMicro > input.allocationLimitAmountMicro) {
    throw new Error('Bot order reserve exceeds strategy allocation limit.')
  }

  return {
    nextAllocatedAmountMicro: input.allocatedAmountMicro - input.reserveAmountMicro,
    nextOpenOrderAmountMicro: input.openOrderAmountMicro + input.reserveAmountMicro,
    nextUsedAmountMicro: input.usedAmountMicro + input.reserveAmountMicro,
  }
}

export function fillLiquidityBotOrder(
  input: FillLiquidityBotOrderInput,
): FillLiquidityBotOrderResult {
  assertPositive(input.reservedAmountMicro, 'reservedAmountMicro')
  assertNonNegative(input.allocatedAmountMicro, 'allocatedAmountMicro')
  assertNonNegative(input.filledAmountMicro, 'filledAmountMicro')
  assertNonNegative(input.openOrderAmountMicro, 'openOrderAmountMicro')
  assertNonNegative(input.positionMarkAmountMicro, 'positionMarkAmountMicro')
  assertNonNegative(input.usedAmountMicro, 'usedAmountMicro')

  if (input.filledAmountMicro > input.reservedAmountMicro) {
    throw new Error('Filled amount cannot exceed reserved amount.')
  }
  if (input.reservedAmountMicro > input.openOrderAmountMicro) {
    throw new Error('Reserved amount exceeds open order balance.')
  }
  if (input.reservedAmountMicro > input.usedAmountMicro) {
    throw new Error('Reserved amount exceeds strategy used amount.')
  }

  const releasedAmountMicro = input.reservedAmountMicro - input.filledAmountMicro
  const positionMarkDeltaMicro = input.positionMarkDeltaMicro ?? input.filledAmountMicro
  assertNonNegative(positionMarkDeltaMicro, 'positionMarkDeltaMicro')

  return {
    releasedAmountMicro,
    nextAllocatedAmountMicro: input.allocatedAmountMicro + releasedAmountMicro,
    nextOpenOrderAmountMicro: input.openOrderAmountMicro - input.reservedAmountMicro,
    nextPositionMarkAmountMicro: input.positionMarkAmountMicro + positionMarkDeltaMicro,
    nextUsedAmountMicro: input.usedAmountMicro - releasedAmountMicro,
  }
}

export function releaseLiquidityBotOrder(
  input: ReleaseLiquidityBotOrderInput,
): ReleaseLiquidityBotOrderResult {
  assertPositive(input.releaseAmountMicro, 'releaseAmountMicro')
  assertNonNegative(input.allocatedAmountMicro, 'allocatedAmountMicro')
  assertNonNegative(input.openOrderAmountMicro, 'openOrderAmountMicro')
  assertNonNegative(input.usedAmountMicro, 'usedAmountMicro')

  if (input.releaseAmountMicro > input.openOrderAmountMicro) {
    throw new Error('Release amount exceeds open order balance.')
  }
  if (input.releaseAmountMicro > input.usedAmountMicro) {
    throw new Error('Release amount exceeds strategy used amount.')
  }

  return {
    nextAllocatedAmountMicro: input.allocatedAmountMicro + input.releaseAmountMicro,
    nextOpenOrderAmountMicro: input.openOrderAmountMicro - input.releaseAmountMicro,
    nextUsedAmountMicro: input.usedAmountMicro - input.releaseAmountMicro,
  }
}
