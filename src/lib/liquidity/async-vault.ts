import { calculateImmediateWithdrawalCapacity } from './math'

const LIQUIDITY_DAILY_NAV_INTERVAL_SECONDS = 86_400

export interface AsyncWithdrawalRequest {
  accountId: string
  claimableAssetsMicro: bigint
  epochId: bigint
  id: string
  remainingSharesMicro: bigint
  requestedAt: Date
  sharesMicro: bigint
  status: 'queued' | 'partial_claimable' | 'claimable' | 'completed' | 'cancelled'
}

export interface BuildAsyncWithdrawalRequestInput {
  accountId: string
  id: string
  requestedAt: Date
  sharesMicro: bigint
  unlockedSharesMicro: bigint
}

export interface AsyncWithdrawCapacityInput {
  idleAmountMicro: bigint
  idleBufferBps: bigint | number
  navAmountMicro: bigint
  navStale?: boolean
  riskBlocked?: boolean
  withdrawalLiabilityAmountMicro?: bigint
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

function epochMs() {
  return LIQUIDITY_DAILY_NAV_INTERVAL_SECONDS * 1_000
}

function getDailyNavEpochId(value: Date) {
  return BigInt(Math.floor(value.getTime() / epochMs()))
}

function getDailyNavEpochClose(epochId: bigint) {
  return new Date(Number(epochId + 1n) * epochMs())
}

export function getNextDailyNavFinalizationTime(value: Date) {
  return getDailyNavEpochClose(getDailyNavEpochId(value))
}

export function calculateAsyncWithdrawCapacity(input: AsyncWithdrawCapacityInput) {
  if (input.navStale || input.riskBlocked) {
    return 0n
  }

  return calculateImmediateWithdrawalCapacity({
    idleAmountMicro: input.idleAmountMicro,
    idleBufferBps: input.idleBufferBps,
    navAmountMicro: input.navAmountMicro,
    withdrawalLiabilityAmountMicro: input.withdrawalLiabilityAmountMicro,
  })
}

export function buildAsyncWithdrawalRequest(input: BuildAsyncWithdrawalRequestInput): AsyncWithdrawalRequest {
  assertPositive(input.sharesMicro, 'sharesMicro')
  assertNonNegative(input.unlockedSharesMicro, 'unlockedSharesMicro')

  if (input.sharesMicro > input.unlockedSharesMicro) {
    throw new Error('Withdrawal shares exceed unlocked shares.')
  }

  return {
    accountId: input.accountId,
    claimableAssetsMicro: 0n,
    epochId: getDailyNavEpochId(input.requestedAt),
    id: input.id,
    remainingSharesMicro: input.sharesMicro,
    requestedAt: input.requestedAt,
    sharesMicro: input.sharesMicro,
    status: 'queued',
  }
}
