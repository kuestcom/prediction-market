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

function ceilUsdcFee(value: number) {
  if (!Number.isFinite(value) || value < 0.00001) {
    return 0
  }
  return Math.ceil((value - Number.EPSILON) * 100_000) / 100_000
}

export function calculateKuestFee(shares: number, price: number, schedule: DynamicFeeSchedule | null | undefined) {
  if (!Number.isFinite(shares) || shares <= 0) {
    return 0
  }
  return roundUsdcFee(shares * calculateKuestUnitFee(price, schedule))
}

export function grossUpKuestFee(kuestFee: number, operatorShareBps: number) {
  const shareBps = Math.min(9_999, Math.max(0, Math.trunc(operatorShareBps)))
  if (kuestFee <= 0 || shareBps <= 0) {
    return kuestFee
  }
  return ceilUsdcFee((kuestFee * 10_000) / (10_000 - shareBps))
}

export function calculateGrossedKuestUnitFee(
  price: number,
  schedule: DynamicFeeSchedule | null | undefined,
  operatorShareBps: number,
) {
  return grossUpKuestFee(calculateKuestUnitFee(price, schedule), operatorShareBps)
}

export function calculateFeeBreakdown({
  shares,
  price,
  schedule,
  operatorShareBps,
}: {
  shares: number
  price: number
  notional: number
  schedule: DynamicFeeSchedule | null | undefined
  operatorShareBps: number
}) {
  const kuestBaseFee = calculateKuestFee(shares, price, schedule)
  const totalFee = grossUpKuestFee(kuestBaseFee, operatorShareBps)
  const totalMicroUsdc = Math.round(totalFee * 1_000_000)
  const operatorMicroUsdc = Math.floor((totalMicroUsdc * Math.max(0, Math.trunc(operatorShareBps))) / 10_000)
  const operatorFee = operatorMicroUsdc / 1_000_000
  const kuestFee = (totalMicroUsdc - operatorMicroUsdc) / 1_000_000
  return { kuestBaseFee, kuestFee, operatorFee, totalFee }
}

export function calculateMarketFillFees(
  fills: Array<{ shares: number; price: number; notional: number }>,
  schedule: DynamicFeeSchedule | null | undefined,
  operatorShareBps: number,
) {
  return fills.reduce(
    (total, fill) => {
      const fee = calculateFeeBreakdown({ ...fill, schedule, operatorShareBps })
      total.kuestFee = Math.round((total.kuestFee + fee.kuestFee) * 1_000_000) / 1_000_000
      total.operatorFee = Math.round((total.operatorFee + fee.operatorFee) * 1_000_000) / 1_000_000
      total.totalFee = Math.round((total.totalFee + fee.totalFee) * 1_000_000) / 1_000_000
      return total
    },
    { kuestFee: 0, operatorFee: 0, totalFee: 0 },
  )
}
