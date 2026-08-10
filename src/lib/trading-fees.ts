export interface DynamicFeeSchedule {
  rate: number
  exponent: number
  takerOnly: boolean
  rebateRate: number
  category?: string
  version?: number
  source?: string
}

export interface FeeRatePayload {
  base_fee?: number | string
  fd?: {
    r?: number | string
    e?: number | string
    to?: boolean
  }
  fee_schedule?: {
    rate?: number | string
    exponent?: number | string
    takerOnly?: boolean
    taker_only?: boolean
    rebateRate?: number | string
    rebate_rate?: number | string
    category?: string
    version?: number
    source?: string
  }
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

export function parseDynamicFeeSchedule(payload: FeeRatePayload): DynamicFeeSchedule {
  const expanded = payload.fee_schedule
  const rate = finiteNumber(expanded?.rate ?? payload.fd?.r)
  const exponent = finiteNumber(expanded?.exponent ?? payload.fd?.e)
  const rebateRate = finiteNumber(expanded?.rebateRate ?? expanded?.rebate_rate) ?? 0

  if (rate === null || rate < 0 || exponent === null || exponent < 0 || rebateRate < 0) {
    throw new Error('Invalid dynamic fee schedule returned from /fee-rate')
  }

  return {
    rate,
    exponent,
    takerOnly: expanded?.takerOnly ?? expanded?.taker_only ?? payload.fd?.to ?? true,
    rebateRate,
    category: expanded?.category,
    version: expanded?.version,
    source: expanded?.source,
  }
}

export function calculateKuestUnitFee(price: number, schedule: DynamicFeeSchedule | null | undefined) {
  if (!schedule || !Number.isFinite(price) || price <= 0 || price >= 1) {
    return 0
  }
  return schedule.rate * (price * (1 - price)) ** schedule.exponent
}

export function roundUsdcFee(value: number) {
  if (!Number.isFinite(value) || value < 0.00001) {
    return 0
  }
  return Math.round((value + Number.EPSILON) * 100_000) / 100_000
}

export function calculateKuestFee(shares: number, price: number, schedule: DynamicFeeSchedule | null | undefined) {
  if (!Number.isFinite(shares) || shares <= 0) {
    return 0
  }
  return roundUsdcFee(shares * calculateKuestUnitFee(price, schedule))
}

function calculateOperatorFee(notional: number, feeBps: number) {
  if (!Number.isFinite(notional) || notional <= 0 || !Number.isFinite(feeBps) || feeBps <= 0) {
    return 0
  }
  return roundUsdcFee((notional * feeBps) / 10_000)
}

export function calculateFeeBreakdown({
  shares,
  price,
  notional,
  schedule,
  operatorFeeBps,
}: {
  shares: number
  price: number
  notional: number
  schedule: DynamicFeeSchedule | null | undefined
  operatorFeeBps: number
}) {
  const kuestFee = calculateKuestFee(shares, price, schedule)
  const operatorFee = calculateOperatorFee(notional, operatorFeeBps)
  return { kuestFee, operatorFee, totalFee: roundUsdcFee(kuestFee + operatorFee) }
}

export function calculateMarketFillFees(
  fills: Array<{ shares: number; price: number; notional: number }>,
  schedule: DynamicFeeSchedule | null | undefined,
  operatorFeeBps: number,
) {
  return fills.reduce(
    (total, fill) => {
      const fee = calculateFeeBreakdown({ ...fill, schedule, operatorFeeBps })
      total.kuestFee = roundUsdcFee(total.kuestFee + fee.kuestFee)
      total.operatorFee = roundUsdcFee(total.operatorFee + fee.operatorFee)
      total.totalFee = roundUsdcFee(total.totalFee + fee.totalFee)
      return total
    },
    { kuestFee: 0, operatorFee: 0, totalFee: 0 },
  )
}
