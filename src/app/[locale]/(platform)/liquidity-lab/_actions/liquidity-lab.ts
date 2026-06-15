'use server'

import type { SerializedLiquidityLabPool, SerializedLiquidityWithdrawalRequest } from '@/lib/liquidity'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { LiquidityRepository } from '@/lib/db/queries/liquidity'
import { UserRepository } from '@/lib/db/queries/user'
import {
  buildDefaultLiquidityPoolCreateInput,
  DEFAULT_LIQUIDITY_POOLS,
  serializeMicroAmount,
} from '@/lib/liquidity'

type LiquidityPoolStateSummary = NonNullable<Awaited<ReturnType<typeof LiquidityRepository.listPoolStates>>['data']>[number]
type LiquidityWithdrawalRequest = NonNullable<Awaited<ReturnType<typeof LiquidityRepository.listWithdrawalRequests>>['data']>[number]

interface LiquidityLabActionResult {
  error: string | null
  message?: string
  pools: SerializedLiquidityLabPool[]
  withdrawalRequests?: SerializedLiquidityWithdrawalRequest[]
}

const PoolAmountSchema = z.object({
  amountMicro: z.string().regex(/^-?\d+$/, 'Amount must be a micro-unit integer.'),
  poolId: z.string().min(1, 'Pool id is required.'),
})
const BotAllocationSchema = PoolAmountSchema.extend({
  marketConditionId: z.string().trim().min(1, 'Market condition id is required.'),
  marketSlug: z.string().trim().optional(),
})
const WithdrawalRequestSchema = z.object({
  requestId: z.string().min(1, 'Withdrawal request id is required.'),
})

function parsePositiveAmountMicro(raw: string, label: string) {
  const amount = BigInt(raw)
  if (amount <= 0n) {
    throw new Error(`${label} must be positive.`)
  }

  return amount
}

function parseSignedNonZeroAmountMicro(raw: string, label: string) {
  const amount = BigInt(raw)
  if (amount === 0n) {
    throw new Error(`${label} must not be zero.`)
  }

  return amount
}

function parseNonNegativeAmountMicro(raw: string, label: string) {
  const amount = BigInt(raw)
  if (amount < 0n) {
    throw new Error(`${label} must be non-negative.`)
  }

  return amount
}

function serializePoolStateSummary(summary: LiquidityPoolStateSummary): SerializedLiquidityLabPool {
  return {
    activeStrategyAllocations: summary.activeStrategyAllocations.map(allocation => ({
      allocatedAmountMicro: serializeMicroAmount(allocation.allocated_amount_micro),
      currentExposureAmountMicro: serializeMicroAmount(allocation.current_exposure_amount_micro),
      marketConditionId: allocation.market_condition_id,
      marketSlug: allocation.market_slug,
      usedAmountMicro: serializeMicroAmount(allocation.used_amount_micro),
    })),
    allocatedAmountMicro: serializeMicroAmount(summary.navSnapshot.allocated_amount_micro),
    badDebtAmountMicro: serializeMicroAmount(summary.navSnapshot.bad_debt_amount_micro),
    categorySlug: summary.pool.category_slug,
    feeAmountMicro: serializeMicroAmount(summary.navSnapshot.fee_amount_micro),
    id: summary.pool.id,
    idleAmountMicro: serializeMicroAmount(summary.navSnapshot.idle_amount_micro),
    idleBufferBps: summary.pool.idle_buffer_bps,
    name: summary.pool.name,
    navAmountMicro: serializeMicroAmount(summary.navSnapshot.nav_amount_micro),
    openOrderAmountMicro: serializeMicroAmount(summary.navSnapshot.open_order_amount_micro),
    positionMarkAmountMicro: serializeMicroAmount(summary.navSnapshot.position_mark_amount_micro),
    realizedPnlAmountMicro: serializeMicroAmount(summary.navSnapshot.realized_pnl_amount_micro),
    rewardsAccruedAmountMicro: serializeMicroAmount(summary.navSnapshot.rewards_accrued_amount_micro),
    riskTier: summary.pool.risk_tier,
    singleMarketCapBps: summary.pool.single_market_cap_bps,
    singleOutcomeCapBps: summary.pool.single_outcome_cap_bps,
    slug: summary.pool.slug,
    status: summary.pool.status,
    totalSharesMicro: serializeMicroAmount(summary.navSnapshot.total_shares_micro),
    unrealizedPnlAmountMicro: serializeMicroAmount(summary.navSnapshot.unrealized_pnl_amount_micro),
    userPrincipalAmountMicro: serializeMicroAmount(summary.position?.principal_amount_micro),
    userSharesMicro: serializeMicroAmount(summary.position?.shares_micro),
    utilizationCapBps: summary.pool.utilization_cap_bps,
    withdrawalLiabilityAmountMicro: serializeMicroAmount(summary.navSnapshot.withdrawal_liability_amount_micro),
  }
}

function serializeWithdrawalRequest(request: LiquidityWithdrawalRequest): SerializedLiquidityWithdrawalRequest {
  return {
    assetsAmountMicro: serializeMicroAmount(request.assets_amount_micro),
    claimableAt: request.claimable_at.toISOString(),
    completedAt: request.completed_at?.toISOString() ?? null,
    createdAt: request.created_at.toISOString(),
    id: request.id,
    immediateAmountMicro: serializeMicroAmount(request.immediate_amount_micro),
    poolId: request.pool_id,
    queuedAmountMicro: serializeMicroAmount(request.queued_amount_micro),
    requestedAmountMicro: request.requested_amount_micro?.toString() ?? null,
    requestedAt: request.requested_at.toISOString(),
    sharePriceMicro: serializeMicroAmount(request.share_price_micro),
    sharesToBurnMicro: serializeMicroAmount(request.shares_to_burn_micro),
    status: request.status,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  }
  finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

async function loadLivePoolsForCurrentUser(message?: string): Promise<LiquidityLabActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  const [poolResult, withdrawalResult] = await withTimeout(
    Promise.all([
      LiquidityRepository.listPoolStates(user?.id),
      user
        ? LiquidityRepository.listWithdrawalRequests({ limit: 25, userId: user.id })
        : Promise.resolve({ data: [], error: null } as const),
    ]),
    5_000,
    'Loading live liquidity state timed out.',
  )

  if (poolResult.error || !poolResult.data) {
    return { error: poolResult.error ?? DEFAULT_ERROR_MESSAGE, pools: [] }
  }
  if (withdrawalResult.error || !withdrawalResult.data) {
    return { error: withdrawalResult.error ?? DEFAULT_ERROR_MESSAGE, pools: [] }
  }

  return {
    error: null,
    message,
    pools: poolResult.data.map(serializePoolStateSummary),
    withdrawalRequests: withdrawalResult.data.map(serializeWithdrawalRequest),
  }
}

async function requireCurrentUser() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', user: null }
  }

  return { error: null, user }
}

async function requireAdminUser() {
  const current = await requireCurrentUser()
  if (current.error || !current.user) {
    return current
  }
  if (!current.user.is_admin) {
    return { error: 'Admin access is required for this liquidity operation.', user: null }
  }

  return current
}

export async function listLiquidityLabPoolsAction(): Promise<LiquidityLabActionResult> {
  try {
    return await loadLivePoolsForCurrentUser('Live pool state loaded.')
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function seedLiquidityLabPoolsAction(): Promise<LiquidityLabActionResult> {
  try {
    const admin = await requireAdminUser()
    if (admin.error) {
      return { error: admin.error, pools: [] }
    }

    let createdCount = 0
    for (const config of DEFAULT_LIQUIDITY_POOLS) {
      const existing = await LiquidityRepository.getPoolBySlug(config.slug)
      if (existing.error) {
        return { error: existing.error, pools: [] }
      }
      if (existing.data) {
        continue
      }

      const created = await LiquidityRepository.createPool(buildDefaultLiquidityPoolCreateInput(config))
      if (created.error) {
        return { error: created.error, pools: [] }
      }
      createdCount += 1
    }

    return await loadLivePoolsForCurrentUser(
      createdCount > 0
        ? `Seeded ${createdCount} liquidity pools.`
        : 'Default liquidity pools already exist.',
    )
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function depositLiquidityLabAction(input: z.input<typeof PoolAmountSchema>): Promise<LiquidityLabActionResult> {
  try {
    const parsed = PoolAmountSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid deposit.', pools: [] }
    }

    const current = await requireCurrentUser()
    if (current.error || !current.user) {
      return { error: current.error ?? 'Unauthenticated.', pools: [] }
    }

    const amountMicro = parsePositiveAmountMicro(parsed.data.amountMicro, 'Deposit amount')
    const result = await LiquidityRepository.deposit({
      amountMicro,
      metadata: { source: 'liquidity-lab' },
      poolId: parsed.data.poolId,
      userId: current.user.id,
    })
    if (result.error || !result.data) {
      return { error: result.error ?? DEFAULT_ERROR_MESSAGE, pools: [] }
    }

    return await loadLivePoolsForCurrentUser(`Deposited ${amountMicro.toString()} micro USDC.`)
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function withdrawLiquidityLabAction(input: z.input<typeof PoolAmountSchema>): Promise<LiquidityLabActionResult> {
  try {
    const parsed = PoolAmountSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid withdrawal.', pools: [] }
    }

    const current = await requireCurrentUser()
    if (current.error || !current.user) {
      return { error: current.error ?? 'Unauthenticated.', pools: [] }
    }

    const amountMicro = parsePositiveAmountMicro(parsed.data.amountMicro, 'Withdrawal amount')
    const result = await LiquidityRepository.requestWithdrawal({
      metadata: { source: 'liquidity-lab' },
      poolId: parsed.data.poolId,
      requestedAmountMicro: amountMicro,
      userId: current.user.id,
    })
    if (result.error || !result.data) {
      return { error: result.error ?? DEFAULT_ERROR_MESSAGE, pools: [] }
    }

    const request = result.data.withdrawalRequest
    return await loadLivePoolsForCurrentUser(
      `Withdrawal requested: ${request.immediate_amount_micro.toString()} immediate, ${request.queued_amount_micro.toString()} queued.`,
    )
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function claimLiquidityWithdrawalLabAction(
  input: z.input<typeof WithdrawalRequestSchema>,
): Promise<LiquidityLabActionResult> {
  try {
    const parsed = WithdrawalRequestSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid withdrawal request.', pools: [] }
    }

    const current = await requireCurrentUser()
    if (current.error || !current.user) {
      return { error: current.error ?? 'Unauthenticated.', pools: [] }
    }

    const result = await LiquidityRepository.completeWithdrawalRequest({
      metadata: { source: 'liquidity-lab' },
      requestId: parsed.data.requestId,
      userId: current.user.id,
    })
    if (result.error) {
      return { error: result.error, pools: [] }
    }

    return await loadLivePoolsForCurrentUser('Withdrawal completed.')
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function allocateLiquidityBotCapitalLabAction(
  input: z.input<typeof BotAllocationSchema>,
): Promise<LiquidityLabActionResult> {
  try {
    const parsed = BotAllocationSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid bot allocation.', pools: [] }
    }

    const admin = await requireAdminUser()
    if (admin.error) {
      return { error: admin.error, pools: [] }
    }

    const amountMicro = parseNonNegativeAmountMicro(parsed.data.amountMicro, 'Bot allocation amount')
    const result = await LiquidityRepository.upsertStrategyAllocation({
      allocatedAmountMicro: amountMicro,
      marketConditionId: parsed.data.marketConditionId,
      marketSlug: parsed.data.marketSlug || null,
      metadata: { source: 'liquidity-lab' },
      poolId: parsed.data.poolId,
      status: amountMicro > 0n ? 'active' : 'paused',
    })
    if (result.error) {
      return { error: result.error, pools: [] }
    }

    return await loadLivePoolsForCurrentUser(`Set bot allocation to ${amountMicro.toString()} micro-units.`)
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function accrueLiquidityRewardLabAction(input: z.input<typeof PoolAmountSchema>): Promise<LiquidityLabActionResult> {
  try {
    const parsed = PoolAmountSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid reward accrual.', pools: [] }
    }

    const admin = await requireAdminUser()
    if (admin.error) {
      return { error: admin.error, pools: [] }
    }

    const amountMicro = parsePositiveAmountMicro(parsed.data.amountMicro, 'Reward amount')
    const result = await LiquidityRepository.recordRewardAccrual({
      metadata: { source: 'liquidity-lab' },
      poolId: parsed.data.poolId,
      rewardAmountMicro: amountMicro,
    })
    if (result.error) {
      return { error: result.error, pools: [] }
    }

    return await loadLivePoolsForCurrentUser(`Accrued ${amountMicro.toString()} reward micro-units into the pool.`)
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}

export async function settleLiquidityBotPnlLabAction(input: z.input<typeof PoolAmountSchema>): Promise<LiquidityLabActionResult> {
  try {
    const parsed = PoolAmountSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Invalid bot PnL settlement.', pools: [] }
    }

    const admin = await requireAdminUser()
    if (admin.error) {
      return { error: admin.error, pools: [] }
    }

    const amountMicro = parseSignedNonZeroAmountMicro(parsed.data.amountMicro, 'Bot PnL amount')
    const result = await LiquidityRepository.recordBotSettlement({
      delta: {
        realizedPnlAmountMicro: amountMicro,
      },
      metadata: { source: 'liquidity-lab' },
      poolId: parsed.data.poolId,
    })
    if (result.error) {
      return { error: result.error, pools: [] }
    }

    return await loadLivePoolsForCurrentUser(`Settled bot PnL ${amountMicro.toString()} micro-units.`)
  }
  catch (error) {
    return {
      error: error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE,
      pools: [],
    }
  }
}
