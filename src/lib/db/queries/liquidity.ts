import type { PoolNavAdjustment, PoolNavDelta, PoolNavState, PoolState } from '@/lib/liquidity'
import type { QueryResult } from '@/types'
import { and, desc, eq, gte, inArray, isNotNull, lt, lte } from 'drizzle-orm'
import {
  liquidity_bot_orders,
  liquidity_pool_ledger_entries,
  liquidity_pool_nav_snapshots,
  liquidity_pool_positions,
  liquidity_pool_strategy_allocations,
  liquidity_pools,
  liquidity_rewards,
  liquidity_withdrawal_requests,
} from '@/lib/db/schema/liquidity/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import {
  applyPoolNavDelta,
  calculateImmediateWithdrawalCapacity,
  calculateNavAmountMicro,
  calculateNextActiveStrategyAllocationTotal,
  calculatePoolState,
  calculatePrincipalForShareBurn,
  calculateRewardPeriodAllocations,
  calculateSharePriceMicro,
  calculateStrategyAllocationCapitalDelta,
  calculateStrategyLimits,
  fillLiquidityBotOrder,
  LIQUIDITY_BOT_ORDER_STATUS,
  LIQUIDITY_DEFAULT_SHARE_PRICE_MICRO,
  LIQUIDITY_LEDGER_ENTRY_TYPE,
  LIQUIDITY_POOL_STATUS,
  LIQUIDITY_REWARD_STATUS,
  LIQUIDITY_WITHDRAWAL_STATUS,
  planWithdrawal,
  previewDeposit,
  releaseLiquidityBotOrder,
  reserveLiquidityBotOrder,
  selectLiquidityClaimableWithdrawalIds,
} from '@/lib/liquidity'

type LiquidityPool = typeof liquidity_pools.$inferSelect
type LiquidityPoolNavSnapshot = typeof liquidity_pool_nav_snapshots.$inferSelect
type LiquidityPoolPosition = typeof liquidity_pool_positions.$inferSelect
type LiquidityPoolLedgerEntry = typeof liquidity_pool_ledger_entries.$inferSelect
type LiquidityWithdrawalRequest = typeof liquidity_withdrawal_requests.$inferSelect
type LiquidityReward = typeof liquidity_rewards.$inferSelect
type LiquidityStrategyAllocation = typeof liquidity_pool_strategy_allocations.$inferSelect
export type LiquidityBotOrder = typeof liquidity_bot_orders.$inferSelect

interface LiquidityPoolStateSummary {
  activeStrategyAllocations: LiquidityStrategyAllocation[]
  navSnapshot: LiquidityPoolNavSnapshot
  pool: LiquidityPool
  position: LiquidityPoolPosition | null
  state: PoolState
}

interface CreateLiquidityPoolInput {
  assetDecimals?: number
  assetSymbol?: string
  botOwnerAddress?: string | null
  categorySlug: string
  description?: string | null
  idleBufferBps?: number
  lockupMultiplierBps?: number
  minLockupSeconds?: number
  name: string
  poolMultiplierBps?: number
  riskTier?: string
  singleMarketCapBps?: number
  singleOutcomeCapBps?: number
  slug: string
  status?: string
  utilizationCapBps?: number
  withdrawalDelaySeconds?: number
}

interface CreateNavSnapshotInput {
  allocatedAmountMicro?: bigint
  asOf?: Date
  badDebtAmountMicro?: bigint
  feeAmountMicro?: bigint
  idleAmountMicro?: bigint
  openOrderAmountMicro?: bigint
  poolId: string
  positionMarkAmountMicro?: bigint
  realizedPnlAmountMicro?: bigint
  rewardsAccruedAmountMicro?: bigint
  source?: string
  totalSharesMicro?: bigint
  unrealizedPnlAmountMicro?: bigint
  withdrawalLiabilityAmountMicro?: bigint
}

interface DepositLiquidityInput {
  amountMicro: bigint
  metadata?: Record<string, unknown> | null
  poolId: string
  userId: string
}

interface RequestWithdrawalInput {
  metadata?: Record<string, unknown> | null
  poolId: string
  requestedAmountMicro?: bigint
  requestedSharesMicro?: bigint
  userId: string
}

interface CompleteWithdrawalRequestInput {
  metadata?: Record<string, unknown> | null
  requestId: string
  userId?: string
}

interface ListWithdrawalRequestsInput {
  limit?: number
  poolId?: string
  statuses?: string[]
  userId?: string
}

interface ListBotOrdersInput {
  clobOrderIds?: string[]
  limit?: number
  poolId?: string
  requireClobOrderId?: boolean
  statuses?: string[]
}

interface MarkClaimableWithdrawalsInput {
  now?: Date
  poolId?: string
}

interface RecordRewardInput {
  metadata?: Record<string, unknown> | null
  periodEnd: Date
  periodStart: Date
  poolId: string
  rewardAmountMicro?: bigint
  rewardPoints?: bigint
  shareTimeWeight: bigint
  status?: string
  userId: string
}

interface ListRewardsInput {
  limit?: number
  periodEnd?: Date
  periodStart?: Date
  poolId?: string
  statuses?: string[]
  userId?: string
}

interface RewardStatusSummary {
  count: number
  rewardAmountMicro: bigint
  rewardPoints: bigint
  shareTimeWeight: bigint
  status: string
}

interface RewardSummary {
  byStatus: RewardStatusSummary[]
  totalCount: number
  totalRewardAmountMicro: bigint
  totalRewardPoints: bigint
  totalShareTimeWeight: bigint
}

interface MarkRewardsPaidInput {
  limit?: number
  metadata?: Record<string, unknown> | null
  paidAt?: Date
  poolId?: string
  rewardIds?: string[]
  statuses?: string[]
  userId?: string
}

interface MarkRewardsPaidResult {
  rewards: LiquidityReward[]
  summary: RewardSummary
}

interface RecordNavAdjustmentInput {
  delta: PoolNavDelta
  metadata?: Record<string, unknown> | null
  poolId: string
  source?: string
  type?: string
}

interface RecordRewardAccrualInput {
  metadata?: Record<string, unknown> | null
  poolId: string
  rewardAmountMicro: bigint
  source?: string
}

interface RecordBotSettlementInput {
  delta: PoolNavDelta
  marketConditionId?: string | null
  metadata?: Record<string, unknown> | null
  poolId: string
  source?: string
}

interface UpsertStrategyAllocationInput {
  allocatedAmountMicro: bigint
  currentExposureAmountMicro?: bigint
  marketConditionId: string
  marketSlug?: string | null
  metadata?: Record<string, unknown> | null
  poolId: string
  status?: string
  usedAmountMicro?: bigint
}

interface ReserveBotOrderInput {
  clobOrderId?: string | null
  marketConditionId: string
  marketSlug?: string | null
  metadata?: Record<string, unknown> | null
  orderType?: string
  poolId: string
  reserveAmountMicro: bigint
  side: 'buy' | 'sell'
  status?: string
  tokenId?: string | null
}

interface FillBotOrderInput {
  botOrderId: string
  clobOrderId?: string | null
  filledAmountMicro: bigint
  metadata?: Record<string, unknown> | null
  positionMarkAmountMicro?: bigint
}

interface ReleaseBotOrderInput {
  botOrderId: string
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
  status?: string
}

interface BotOrderSettlementInput {
  botOrderId: string
  metadata?: Record<string, unknown> | null
  payoutAmountMicro: bigint
}

interface SettleBotOrdersInput {
  metadata?: Record<string, unknown> | null
  poolId: string
  settlements: BotOrderSettlementInput[]
  source?: string
  targetUnrealizedPnlAmountMicro?: bigint
}

interface MarkBotOrderSubmittedInput {
  botOrderId: string
  clobOrderId: string
  metadata?: Record<string, unknown> | null
}

interface CalculateRewardPeriodInput {
  metadata?: Record<string, unknown> | null
  periodEnd: Date
  periodStart: Date
  poolId: string
  replaceExisting?: boolean
  status?: string
  totalRewardMicro: bigint
  totalRewardPoints?: bigint
  utilizationMultiplierBps?: number
}

function buildEmptyNavSnapshot(poolId: string): LiquidityPoolNavSnapshot {
  const now = new Date()
  return {
    id: '',
    pool_id: poolId,
    nav_amount_micro: 0n,
    idle_amount_micro: 0n,
    allocated_amount_micro: 0n,
    open_order_amount_micro: 0n,
    position_mark_amount_micro: 0n,
    withdrawal_liability_amount_micro: 0n,
    rewards_accrued_amount_micro: 0n,
    realized_pnl_amount_micro: 0n,
    unrealized_pnl_amount_micro: 0n,
    fee_amount_micro: 0n,
    bad_debt_amount_micro: 0n,
    total_shares_micro: 0n,
    share_price_micro: LIQUIDITY_DEFAULT_SHARE_PRICE_MICRO,
    source: 'empty',
    as_of: now,
    created_at: now,
  }
}

function buildNavStateFromSnapshot(snapshot: LiquidityPoolNavSnapshot): PoolNavState {
  return {
    allocatedAmountMicro: snapshot.allocated_amount_micro,
    badDebtAmountMicro: snapshot.bad_debt_amount_micro,
    feeAmountMicro: snapshot.fee_amount_micro,
    idleAmountMicro: snapshot.idle_amount_micro,
    navAmountMicro: snapshot.nav_amount_micro,
    openOrderAmountMicro: snapshot.open_order_amount_micro,
    positionMarkAmountMicro: snapshot.position_mark_amount_micro,
    realizedPnlAmountMicro: snapshot.realized_pnl_amount_micro,
    rewardsAccruedAmountMicro: snapshot.rewards_accrued_amount_micro,
    totalSharesMicro: snapshot.total_shares_micro,
    unrealizedPnlAmountMicro: snapshot.unrealized_pnl_amount_micro,
    withdrawalLiabilityAmountMicro: snapshot.withdrawal_liability_amount_micro,
  }
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + (seconds * 1000))
}

async function getLatestNavSnapshotOrEmpty(poolId: string) {
  const rows = await db
    .select()
    .from(liquidity_pool_nav_snapshots)
    .where(eq(liquidity_pool_nav_snapshots.pool_id, poolId))
    .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
    .limit(1)

  return rows[0] ?? buildEmptyNavSnapshot(poolId)
}

async function getPosition(poolId: string, userId: string) {
  const rows = await db
    .select()
    .from(liquidity_pool_positions)
    .where(and(
      eq(liquidity_pool_positions.pool_id, poolId),
      eq(liquidity_pool_positions.user_id, userId),
    ))
    .limit(1)

  return rows[0] ?? null
}

async function getActiveStrategyAllocations(poolId: string) {
  return await db
    .select()
    .from(liquidity_pool_strategy_allocations)
    .where(and(
      eq(liquidity_pool_strategy_allocations.pool_id, poolId),
      eq(liquidity_pool_strategy_allocations.status, 'active'),
    ))
}

function buildRewardConditions(input: ListRewardsInput | MarkRewardsPaidInput) {
  const conditions = []
  if ('rewardIds' in input && input.rewardIds?.length) {
    conditions.push(inArray(liquidity_rewards.id, input.rewardIds))
  }
  if (input.poolId) {
    conditions.push(eq(liquidity_rewards.pool_id, input.poolId))
  }
  if (input.userId) {
    conditions.push(eq(liquidity_rewards.user_id, input.userId))
  }
  if (input.statuses?.length) {
    conditions.push(inArray(liquidity_rewards.status, input.statuses))
  }
  if ('periodStart' in input && input.periodStart) {
    conditions.push(gte(liquidity_rewards.period_start, input.periodStart))
  }
  if ('periodEnd' in input && input.periodEnd) {
    conditions.push(lte(liquidity_rewards.period_end, input.periodEnd))
  }

  return conditions
}

function summarizeRewards(rewards: LiquidityReward[]): RewardSummary {
  const byStatus = new Map<string, RewardStatusSummary>()
  let totalCount = 0
  let totalRewardAmountMicro = 0n
  let totalRewardPoints = 0n
  let totalShareTimeWeight = 0n

  for (const reward of rewards) {
    totalCount += 1
    totalRewardAmountMicro += reward.reward_amount_micro
    totalRewardPoints += reward.reward_points
    totalShareTimeWeight += reward.share_time_weight

    const current = byStatus.get(reward.status) ?? {
      count: 0,
      rewardAmountMicro: 0n,
      rewardPoints: 0n,
      shareTimeWeight: 0n,
      status: reward.status,
    }
    current.count += 1
    current.rewardAmountMicro += reward.reward_amount_micro
    current.rewardPoints += reward.reward_points
    current.shareTimeWeight += reward.share_time_weight
    byStatus.set(reward.status, current)
  }

  return {
    byStatus: Array.from(byStatus.values()).sort((a, b) => a.status.localeCompare(b.status)),
    totalCount,
    totalRewardAmountMicro,
    totalRewardPoints,
    totalShareTimeWeight,
  }
}

async function buildPoolStateSummary(
  pool: LiquidityPool,
  userId?: string,
): Promise<LiquidityPoolStateSummary> {
  const latest = await getLatestNavSnapshotOrEmpty(pool.id)
  const activeStrategyAllocations = await getActiveStrategyAllocations(pool.id)
  const position = userId ? await getPosition(pool.id, userId) : null
  const state = calculatePoolState({
    activeStrategyAllocations: activeStrategyAllocations.map(allocation => ({
      allocatedAmountMicro: allocation.allocated_amount_micro,
      currentExposureAmountMicro: allocation.current_exposure_amount_micro,
      usedAmountMicro: allocation.used_amount_micro,
    })),
    allocatedAmountMicro: latest.allocated_amount_micro,
    idleAmountMicro: latest.idle_amount_micro,
    idleBufferBps: pool.idle_buffer_bps,
    navAmountMicro: latest.nav_amount_micro,
    singleMarketCapBps: pool.single_market_cap_bps,
    singleOutcomeCapBps: pool.single_outcome_cap_bps,
    totalSharesMicro: latest.total_shares_micro,
    userPosition: position
      ? {
          principalAmountMicro: position.principal_amount_micro,
          sharesMicro: position.shares_micro,
        }
      : null,
    utilizationCapBps: pool.utilization_cap_bps,
    withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
  })

  return {
    activeStrategyAllocations,
    navSnapshot: latest,
    pool,
    position,
    state,
  }
}

export const LiquidityRepository = {
  async createPool(input: CreateLiquidityPoolInput): Promise<QueryResult<LiquidityPool>> {
    return runQuery(async () => {
      const rows = await db
        .insert(liquidity_pools)
        .values({
          asset_decimals: input.assetDecimals,
          asset_symbol: input.assetSymbol,
          bot_owner_address: input.botOwnerAddress,
          category_slug: input.categorySlug,
          description: input.description,
          idle_buffer_bps: input.idleBufferBps,
          lockup_multiplier_bps: input.lockupMultiplierBps,
          min_lockup_seconds: input.minLockupSeconds,
          name: input.name,
          pool_multiplier_bps: input.poolMultiplierBps,
          risk_tier: input.riskTier,
          single_market_cap_bps: input.singleMarketCapBps,
          single_outcome_cap_bps: input.singleOutcomeCapBps,
          slug: input.slug,
          status: input.status,
          utilization_cap_bps: input.utilizationCapBps,
          withdrawal_delay_seconds: input.withdrawalDelaySeconds,
        })
        .returning()

      return { data: rows[0], error: null }
    })
  },

  async listPools(): Promise<QueryResult<LiquidityPool[]>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(liquidity_pools)
        .orderBy(liquidity_pools.category_slug, liquidity_pools.name)

      return { data: rows, error: null }
    })
  },

  async getPoolBySlug(slug: string): Promise<QueryResult<LiquidityPool | null>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(liquidity_pools)
        .where(eq(liquidity_pools.slug, slug))
        .limit(1)

      return { data: rows[0] ?? null, error: null }
    })
  },

  async getPoolState(poolId: string, userId?: string): Promise<QueryResult<LiquidityPoolStateSummary | null>> {
    return runQuery(async () => {
      const poolRows = await db
        .select()
        .from(liquidity_pools)
        .where(eq(liquidity_pools.id, poolId))
        .limit(1)
      const pool = poolRows[0] ?? null
      if (!pool) {
        return { data: null, error: null }
      }

      return {
        data: await buildPoolStateSummary(pool, userId),
        error: null,
      }
    })
  },

  async getPoolStateBySlug(slug: string, userId?: string): Promise<QueryResult<LiquidityPoolStateSummary | null>> {
    return runQuery(async () => {
      const poolRows = await db
        .select()
        .from(liquidity_pools)
        .where(eq(liquidity_pools.slug, slug))
        .limit(1)
      const pool = poolRows[0] ?? null
      if (!pool) {
        return { data: null, error: null }
      }

      return {
        data: await buildPoolStateSummary(pool, userId),
        error: null,
      }
    })
  },

  async listPoolStates(userId?: string): Promise<QueryResult<LiquidityPoolStateSummary[]>> {
    return runQuery(async () => {
      const pools = await db
        .select()
        .from(liquidity_pools)
        .orderBy(liquidity_pools.category_slug, liquidity_pools.name)
      const summaries: LiquidityPoolStateSummary[] = []

      for (const pool of pools) {
        summaries.push(await buildPoolStateSummary(pool, userId))
      }

      return { data: summaries, error: null }
    })
  },

  async getLatestNavSnapshot(poolId: string): Promise<QueryResult<LiquidityPoolNavSnapshot>> {
    return runQuery(async () => ({
      data: await getLatestNavSnapshotOrEmpty(poolId),
      error: null,
    }))
  },

  async getPosition(poolId: string, userId: string): Promise<QueryResult<LiquidityPoolPosition | null>> {
    return runQuery(async () => ({
      data: await getPosition(poolId, userId),
      error: null,
    }))
  },

  async listPositions(poolId: string): Promise<QueryResult<LiquidityPoolPosition[]>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(liquidity_pool_positions)
        .where(eq(liquidity_pool_positions.pool_id, poolId))

      return { data: rows, error: null }
    })
  },

  async listStrategyAllocations(poolId: string): Promise<QueryResult<LiquidityStrategyAllocation[]>> {
    return runQuery(async () => {
      const rows = await db
        .select()
        .from(liquidity_pool_strategy_allocations)
        .where(eq(liquidity_pool_strategy_allocations.pool_id, poolId))

      return { data: rows, error: null }
    })
  },

  async listWithdrawalRequests(
    input: ListWithdrawalRequestsInput = {},
  ): Promise<QueryResult<LiquidityWithdrawalRequest[]>> {
    return runQuery(async () => {
      const conditions = []
      if (input.poolId) {
        conditions.push(eq(liquidity_withdrawal_requests.pool_id, input.poolId))
      }
      if (input.userId) {
        conditions.push(eq(liquidity_withdrawal_requests.user_id, input.userId))
      }
      if (input.statuses?.length) {
        conditions.push(inArray(liquidity_withdrawal_requests.status, input.statuses))
      }

      const rows = await db
        .select()
        .from(liquidity_withdrawal_requests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(liquidity_withdrawal_requests.requested_at))
        .limit(input.limit ?? 50)

      return { data: rows, error: null }
    })
  },

  async listRewards(input: ListRewardsInput = {}): Promise<QueryResult<LiquidityReward[]>> {
    return runQuery(async () => {
      const conditions = buildRewardConditions(input)
      const rows = await db
        .select()
        .from(liquidity_rewards)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(liquidity_rewards.period_end), desc(liquidity_rewards.created_at))
        .limit(input.limit ?? 100)

      return { data: rows, error: null }
    })
  },

  async getRewardSummary(input: ListRewardsInput = {}): Promise<QueryResult<RewardSummary>> {
    return runQuery(async () => {
      const conditions = buildRewardConditions(input)
      const rows = await db
        .select()
        .from(liquidity_rewards)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      return { data: summarizeRewards(rows), error: null }
    })
  },

  async listBotOrders(
    input: ListBotOrdersInput = {},
  ): Promise<QueryResult<LiquidityBotOrder[]>> {
    return runQuery(async () => {
      const conditions = []
      if (input.poolId) {
        conditions.push(eq(liquidity_bot_orders.pool_id, input.poolId))
      }
      if (input.statuses?.length) {
        conditions.push(inArray(liquidity_bot_orders.status, input.statuses))
      }
      if (input.clobOrderIds?.length) {
        conditions.push(inArray(liquidity_bot_orders.clob_order_id, input.clobOrderIds))
      }
      if (input.requireClobOrderId) {
        conditions.push(isNotNull(liquidity_bot_orders.clob_order_id))
      }

      const rows = await db
        .select()
        .from(liquidity_bot_orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(liquidity_bot_orders.created_at))
        .limit(input.limit ?? 100)

      return { data: rows, error: null }
    })
  },

  async markClaimableWithdrawals(
    input: MarkClaimableWithdrawalsInput = {},
  ): Promise<QueryResult<LiquidityWithdrawalRequest[]>> {
    return runQuery(async () => {
      const now = input.now ?? new Date()
      const conditions = [
        eq(liquidity_withdrawal_requests.status, LIQUIDITY_WITHDRAWAL_STATUS.QUEUED),
        lte(liquidity_withdrawal_requests.claimable_at, now),
      ]
      if (input.poolId) {
        conditions.push(eq(liquidity_withdrawal_requests.pool_id, input.poolId))
      }

      const dueRows = await db
        .select()
        .from(liquidity_withdrawal_requests)
        .where(and(...conditions))
        .orderBy(
          liquidity_withdrawal_requests.pool_id,
          liquidity_withdrawal_requests.claimable_at,
          liquidity_withdrawal_requests.requested_at,
        )

      if (dueRows.length === 0) {
        return { data: [], error: null }
      }

      const poolIds = Array.from(new Set(dueRows.map(row => row.pool_id)))
      const poolLiquidity = []

      for (const poolId of poolIds) {
        const latest = await getLatestNavSnapshotOrEmpty(poolId)
        const existingClaimableRows = await db
          .select()
          .from(liquidity_withdrawal_requests)
          .where(and(
            eq(liquidity_withdrawal_requests.pool_id, poolId),
            eq(liquidity_withdrawal_requests.status, LIQUIDITY_WITHDRAWAL_STATUS.CLAIMABLE),
          ))
        const existingClaimableQueuedAmountMicro = existingClaimableRows.reduce(
          (sum, request) => sum + request.queued_amount_micro,
          0n,
        )

        poolLiquidity.push({
          existingClaimableQueuedAmountMicro,
          idleAmountMicro: latest.idle_amount_micro,
          poolId,
        })
      }

      const selection = selectLiquidityClaimableWithdrawalIds({
        candidates: dueRows.map(row => ({
          claimableAt: row.claimable_at,
          id: row.id,
          poolId: row.pool_id,
          queuedAmountMicro: row.queued_amount_micro,
          requestedAt: row.requested_at,
        })),
        poolLiquidity,
      })

      if (selection.selectedIds.length === 0) {
        return { data: [], error: null }
      }

      const rows = await db
        .update(liquidity_withdrawal_requests)
        .set({
          status: LIQUIDITY_WITHDRAWAL_STATUS.CLAIMABLE,
          updated_at: now,
        })
        .where(inArray(liquidity_withdrawal_requests.id, selection.selectedIds))
        .returning()

      return { data: rows, error: null }
    })
  },

  async recordNavSnapshot(input: CreateNavSnapshotInput): Promise<QueryResult<LiquidityPoolNavSnapshot>> {
    return runQuery(async () => {
      const totalSharesMicro = input.totalSharesMicro ?? 0n
      const navAmountMicro = calculateNavAmountMicro(input)
      const sharePriceMicro = calculateSharePriceMicro({
        navAmountMicro,
        totalSharesMicro,
      })

      const rows = await db
        .insert(liquidity_pool_nav_snapshots)
        .values({
          allocated_amount_micro: input.allocatedAmountMicro ?? 0n,
          as_of: input.asOf,
          bad_debt_amount_micro: input.badDebtAmountMicro ?? 0n,
          fee_amount_micro: input.feeAmountMicro ?? 0n,
          idle_amount_micro: input.idleAmountMicro ?? 0n,
          nav_amount_micro: navAmountMicro,
          open_order_amount_micro: input.openOrderAmountMicro ?? 0n,
          pool_id: input.poolId,
          position_mark_amount_micro: input.positionMarkAmountMicro ?? 0n,
          withdrawal_liability_amount_micro: input.withdrawalLiabilityAmountMicro ?? 0n,
          realized_pnl_amount_micro: input.realizedPnlAmountMicro ?? 0n,
          rewards_accrued_amount_micro: input.rewardsAccruedAmountMicro ?? 0n,
          share_price_micro: sharePriceMicro,
          source: input.source,
          total_shares_micro: totalSharesMicro,
          unrealized_pnl_amount_micro: input.unrealizedPnlAmountMicro ?? 0n,
        })
        .returning()

      return { data: rows[0], error: null }
    })
  },

  async recordNavAdjustment(input: RecordNavAdjustmentInput): Promise<QueryResult<{
    adjustment: PoolNavAdjustment
    ledgerEntry: LiquidityPoolLedgerEntry
    navSnapshot: LiquidityPoolNavSnapshot
  }>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)
        const adjustment = applyPoolNavDelta({
          delta: input.delta,
          state: buildNavStateFromSnapshot(latest),
        })
        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: adjustment.next.allocatedAmountMicro,
            bad_debt_amount_micro: adjustment.next.badDebtAmountMicro,
            fee_amount_micro: adjustment.next.feeAmountMicro,
            idle_amount_micro: adjustment.next.idleAmountMicro,
            nav_amount_micro: adjustment.next.navAmountMicro,
            open_order_amount_micro: adjustment.next.openOrderAmountMicro,
            pool_id: input.poolId,
            position_mark_amount_micro: adjustment.next.positionMarkAmountMicro,
            withdrawal_liability_amount_micro: adjustment.next.withdrawalLiabilityAmountMicro,
            realized_pnl_amount_micro: adjustment.next.realizedPnlAmountMicro,
            rewards_accrued_amount_micro: adjustment.next.rewardsAccruedAmountMicro,
            share_price_micro: adjustment.next.sharePriceMicro,
            source: input.source ?? input.type ?? LIQUIDITY_LEDGER_ENTRY_TYPE.NAV_ADJUSTMENT,
            total_shares_micro: adjustment.next.totalSharesMicro,
            unrealized_pnl_amount_micro: adjustment.next.unrealizedPnlAmountMicro,
          })
          .returning()
        const ledgerRows = await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: adjustment.amountDeltaMicro,
            metadata: input.metadata,
            nav_amount_micro: adjustment.next.navAmountMicro,
            pool_id: input.poolId,
            share_delta_micro: 0n,
            share_price_micro: adjustment.next.sharePriceMicro,
            type: input.type ?? LIQUIDITY_LEDGER_ENTRY_TYPE.NAV_ADJUSTMENT,
          })
          .returning()

        return {
          adjustment,
          ledgerEntry: ledgerRows[0],
          navSnapshot: navRows[0],
        }
      })

      return { data: result, error: null }
    })
  },

  async recordRewardAccrual(input: RecordRewardAccrualInput): Promise<QueryResult<{
    adjustment: PoolNavAdjustment
    ledgerEntry: LiquidityPoolLedgerEntry
    navSnapshot: LiquidityPoolNavSnapshot
  }>> {
    if (input.rewardAmountMicro <= 0n) {
      return { data: null, error: 'Reward amount must be positive.' }
    }

    return LiquidityRepository.recordNavAdjustment({
      delta: {
        rewardsAccruedAmountMicro: input.rewardAmountMicro,
      },
      metadata: input.metadata,
      poolId: input.poolId,
      source: input.source ?? 'reward_accrual',
      type: LIQUIDITY_LEDGER_ENTRY_TYPE.REWARD_ACCRUAL,
    })
  },

  async recordBotSettlement(input: RecordBotSettlementInput): Promise<QueryResult<{
    adjustment: PoolNavAdjustment
    ledgerEntry: LiquidityPoolLedgerEntry
    navSnapshot: LiquidityPoolNavSnapshot
  }>> {
    return LiquidityRepository.recordNavAdjustment({
      delta: input.delta,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.marketConditionId ? { marketConditionId: input.marketConditionId } : {}),
      },
      poolId: input.poolId,
      source: input.source ?? 'bot_settlement',
      type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_SETTLEMENT,
    })
  },

  async reserveBotOrder(input: ReserveBotOrderInput): Promise<QueryResult<{
    botOrder: LiquidityBotOrder
    navSnapshot: LiquidityPoolNavSnapshot
    strategyAllocation: LiquidityStrategyAllocation
  }>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const allocationRows = await tx
          .select()
          .from(liquidity_pool_strategy_allocations)
          .where(and(
            eq(liquidity_pool_strategy_allocations.pool_id, input.poolId),
            eq(liquidity_pool_strategy_allocations.market_condition_id, input.marketConditionId),
          ))
          .limit(1)
        const allocation = allocationRows[0] ?? null
        if (!allocation) {
          throw new Error('Strategy allocation not found.')
        }
        if (allocation.status !== 'active') {
          throw new Error('Strategy allocation is not active.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)
        const reserve = reserveLiquidityBotOrder({
          allocatedAmountMicro: latest.allocated_amount_micro,
          allocationLimitAmountMicro: allocation.allocated_amount_micro,
          openOrderAmountMicro: latest.open_order_amount_micro,
          reserveAmountMicro: input.reserveAmountMicro,
          usedAmountMicro: allocation.used_amount_micro,
        })
        const nextNavAmountMicro = calculateNavAmountMicro({
          allocatedAmountMicro: reserve.nextAllocatedAmountMicro,
          badDebtAmountMicro: latest.bad_debt_amount_micro,
          feeAmountMicro: latest.fee_amount_micro,
          idleAmountMicro: latest.idle_amount_micro,
          openOrderAmountMicro: reserve.nextOpenOrderAmountMicro,
          positionMarkAmountMicro: latest.position_mark_amount_micro,
          realizedPnlAmountMicro: latest.realized_pnl_amount_micro,
          rewardsAccruedAmountMicro: latest.rewards_accrued_amount_micro,
          unrealizedPnlAmountMicro: latest.unrealized_pnl_amount_micro,
          withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
        })
        const nextSharePriceMicro = calculateSharePriceMicro({
          navAmountMicro: nextNavAmountMicro,
          totalSharesMicro: latest.total_shares_micro,
        })

        const allocationUpdateRows = await tx
          .update(liquidity_pool_strategy_allocations)
          .set({
            used_amount_micro: reserve.nextUsedAmountMicro,
          })
          .where(eq(liquidity_pool_strategy_allocations.id, allocation.id))
          .returning()
        const orderRows = await tx
          .insert(liquidity_bot_orders)
          .values({
            clob_order_id: input.clobOrderId,
            market_condition_id: input.marketConditionId,
            market_slug: input.marketSlug,
            metadata: input.metadata,
            order_type: input.orderType,
            pool_id: input.poolId,
            reserved_amount_micro: input.reserveAmountMicro,
            side: input.side,
            status: input.status ?? (
              input.clobOrderId
                ? LIQUIDITY_BOT_ORDER_STATUS.SUBMITTED
                : LIQUIDITY_BOT_ORDER_STATUS.RESERVED
            ),
            strategy_allocation_id: allocation.id,
            token_id: input.tokenId,
          })
          .returning()
        const botOrder = orderRows[0]
        if (!botOrder) {
          throw new Error('Failed to create bot order.')
        }

        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: reserve.nextAllocatedAmountMicro,
            bad_debt_amount_micro: latest.bad_debt_amount_micro,
            fee_amount_micro: latest.fee_amount_micro,
            idle_amount_micro: latest.idle_amount_micro,
            nav_amount_micro: nextNavAmountMicro,
            open_order_amount_micro: reserve.nextOpenOrderAmountMicro,
            pool_id: input.poolId,
            position_mark_amount_micro: latest.position_mark_amount_micro,
            withdrawal_liability_amount_micro: latest.withdrawal_liability_amount_micro,
            realized_pnl_amount_micro: latest.realized_pnl_amount_micro,
            rewards_accrued_amount_micro: latest.rewards_accrued_amount_micro,
            share_price_micro: nextSharePriceMicro,
            source: 'bot_order_reserve',
            total_shares_micro: latest.total_shares_micro,
            unrealized_pnl_amount_micro: latest.unrealized_pnl_amount_micro,
          })
          .returning()

        await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: 0n,
            metadata: {
              ...(input.metadata ?? {}),
              botOrderId: botOrder.id,
              clobOrderId: input.clobOrderId ?? null,
              marketConditionId: input.marketConditionId,
              reserveAmountMicro: input.reserveAmountMicro.toString(),
            },
            nav_amount_micro: nextNavAmountMicro,
            pool_id: input.poolId,
            share_delta_micro: 0n,
            share_price_micro: nextSharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_ORDER_RESERVE,
          })

        return {
          botOrder,
          navSnapshot: navRows[0],
          strategyAllocation: allocationUpdateRows[0],
        }
      })

      return { data: result, error: null }
    })
  },

  async markBotOrderSubmitted(input: MarkBotOrderSubmittedInput): Promise<QueryResult<LiquidityBotOrder>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const orderRows = await tx
          .select()
          .from(liquidity_bot_orders)
          .where(eq(liquidity_bot_orders.id, input.botOrderId))
          .limit(1)
        const order = orderRows[0] ?? null
        if (!order) {
          throw new Error('Bot order not found.')
        }
        if (
          order.status === LIQUIDITY_BOT_ORDER_STATUS.FILLED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.RELEASED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.FAILED
        ) {
          throw new Error('Bot order is already finalized.')
        }

        const rows = await tx
          .update(liquidity_bot_orders)
          .set({
            clob_order_id: input.clobOrderId,
            metadata: {
              ...(order.metadata ?? {}),
              ...(input.metadata ?? {}),
            },
            status: LIQUIDITY_BOT_ORDER_STATUS.SUBMITTED,
          })
          .where(eq(liquidity_bot_orders.id, order.id))
          .returning()

        return rows[0]
      })

      return { data: result, error: null }
    })
  },

  async fillBotOrder(input: FillBotOrderInput): Promise<QueryResult<{
    botOrder: LiquidityBotOrder
    navSnapshot: LiquidityPoolNavSnapshot
    strategyAllocation: LiquidityStrategyAllocation
  }>> {
    if (input.filledAmountMicro <= 0n) {
      return { data: null, error: 'Filled amount must be positive.' }
    }

    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const orderRows = await tx
          .select()
          .from(liquidity_bot_orders)
          .where(eq(liquidity_bot_orders.id, input.botOrderId))
          .limit(1)
        const order = orderRows[0] ?? null
        if (!order) {
          throw new Error('Bot order not found.')
        }
        if (
          order.status === LIQUIDITY_BOT_ORDER_STATUS.FILLED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.RELEASED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.FAILED
        ) {
          throw new Error('Bot order is already finalized.')
        }

        const allocationRows = await tx
          .select()
          .from(liquidity_pool_strategy_allocations)
          .where(order.strategy_allocation_id
            ? eq(liquidity_pool_strategy_allocations.id, order.strategy_allocation_id)
            : and(
                eq(liquidity_pool_strategy_allocations.pool_id, order.pool_id),
                eq(liquidity_pool_strategy_allocations.market_condition_id, order.market_condition_id),
              ))
          .limit(1)
        const allocation = allocationRows[0] ?? null
        if (!allocation) {
          throw new Error('Strategy allocation not found.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, order.pool_id))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(order.pool_id)
        const positionMarkDeltaMicro = input.positionMarkAmountMicro ?? input.filledAmountMicro
        const fill = fillLiquidityBotOrder({
          allocatedAmountMicro: latest.allocated_amount_micro,
          filledAmountMicro: input.filledAmountMicro,
          openOrderAmountMicro: latest.open_order_amount_micro,
          positionMarkAmountMicro: latest.position_mark_amount_micro,
          positionMarkDeltaMicro,
          reservedAmountMicro: order.reserved_amount_micro,
          usedAmountMicro: allocation.used_amount_micro,
        })
        const nextNavAmountMicro = calculateNavAmountMicro({
          allocatedAmountMicro: fill.nextAllocatedAmountMicro,
          badDebtAmountMicro: latest.bad_debt_amount_micro,
          feeAmountMicro: latest.fee_amount_micro,
          idleAmountMicro: latest.idle_amount_micro,
          openOrderAmountMicro: fill.nextOpenOrderAmountMicro,
          positionMarkAmountMicro: fill.nextPositionMarkAmountMicro,
          realizedPnlAmountMicro: latest.realized_pnl_amount_micro,
          rewardsAccruedAmountMicro: latest.rewards_accrued_amount_micro,
          unrealizedPnlAmountMicro: latest.unrealized_pnl_amount_micro,
          withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
        })
        const nextSharePriceMicro = calculateSharePriceMicro({
          navAmountMicro: nextNavAmountMicro,
          totalSharesMicro: latest.total_shares_micro,
        })

        const allocationUpdateRows = await tx
          .update(liquidity_pool_strategy_allocations)
          .set({
            current_exposure_amount_micro: allocation.current_exposure_amount_micro + positionMarkDeltaMicro,
            used_amount_micro: fill.nextUsedAmountMicro,
          })
          .where(eq(liquidity_pool_strategy_allocations.id, allocation.id))
          .returning()
        const orderUpdateRows = await tx
          .update(liquidity_bot_orders)
          .set({
            clob_order_id: input.clobOrderId ?? order.clob_order_id,
            filled_amount_micro: input.filledAmountMicro,
            metadata: {
              ...(order.metadata ?? {}),
              ...(input.metadata ?? {}),
            },
            position_mark_amount_micro: positionMarkDeltaMicro,
            released_amount_micro: fill.releasedAmountMicro,
            status: LIQUIDITY_BOT_ORDER_STATUS.FILLED,
          })
          .where(eq(liquidity_bot_orders.id, order.id))
          .returning()
        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: fill.nextAllocatedAmountMicro,
            bad_debt_amount_micro: latest.bad_debt_amount_micro,
            fee_amount_micro: latest.fee_amount_micro,
            idle_amount_micro: latest.idle_amount_micro,
            nav_amount_micro: nextNavAmountMicro,
            open_order_amount_micro: fill.nextOpenOrderAmountMicro,
            pool_id: order.pool_id,
            position_mark_amount_micro: fill.nextPositionMarkAmountMicro,
            withdrawal_liability_amount_micro: latest.withdrawal_liability_amount_micro,
            realized_pnl_amount_micro: latest.realized_pnl_amount_micro,
            rewards_accrued_amount_micro: latest.rewards_accrued_amount_micro,
            share_price_micro: nextSharePriceMicro,
            source: 'bot_order_fill',
            total_shares_micro: latest.total_shares_micro,
            unrealized_pnl_amount_micro: latest.unrealized_pnl_amount_micro,
          })
          .returning()

        await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: positionMarkDeltaMicro - input.filledAmountMicro,
            metadata: {
              ...(input.metadata ?? {}),
              botOrderId: order.id,
              clobOrderId: input.clobOrderId ?? order.clob_order_id,
              filledAmountMicro: input.filledAmountMicro.toString(),
              releasedAmountMicro: fill.releasedAmountMicro.toString(),
            },
            nav_amount_micro: nextNavAmountMicro,
            pool_id: order.pool_id,
            share_delta_micro: 0n,
            share_price_micro: nextSharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_ORDER_FILL,
          })

        return {
          botOrder: orderUpdateRows[0],
          navSnapshot: navRows[0],
          strategyAllocation: allocationUpdateRows[0],
        }
      })

      return { data: result, error: null }
    })
  },

  async releaseBotOrder(input: ReleaseBotOrderInput): Promise<QueryResult<{
    botOrder: LiquidityBotOrder
    navSnapshot: LiquidityPoolNavSnapshot
    strategyAllocation: LiquidityStrategyAllocation
  }>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const orderRows = await tx
          .select()
          .from(liquidity_bot_orders)
          .where(eq(liquidity_bot_orders.id, input.botOrderId))
          .limit(1)
        const order = orderRows[0] ?? null
        if (!order) {
          throw new Error('Bot order not found.')
        }
        if (
          order.status === LIQUIDITY_BOT_ORDER_STATUS.FILLED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.RELEASED
          || order.status === LIQUIDITY_BOT_ORDER_STATUS.FAILED
        ) {
          throw new Error('Bot order is already finalized.')
        }

        const allocationRows = await tx
          .select()
          .from(liquidity_pool_strategy_allocations)
          .where(order.strategy_allocation_id
            ? eq(liquidity_pool_strategy_allocations.id, order.strategy_allocation_id)
            : and(
                eq(liquidity_pool_strategy_allocations.pool_id, order.pool_id),
                eq(liquidity_pool_strategy_allocations.market_condition_id, order.market_condition_id),
              ))
          .limit(1)
        const allocation = allocationRows[0] ?? null
        if (!allocation) {
          throw new Error('Strategy allocation not found.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, order.pool_id))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(order.pool_id)
        const releaseAmountMicro = order.reserved_amount_micro - order.filled_amount_micro - order.released_amount_micro
        const release = releaseLiquidityBotOrder({
          allocatedAmountMicro: latest.allocated_amount_micro,
          openOrderAmountMicro: latest.open_order_amount_micro,
          releaseAmountMicro,
          usedAmountMicro: allocation.used_amount_micro,
        })
        const nextNavAmountMicro = calculateNavAmountMicro({
          allocatedAmountMicro: release.nextAllocatedAmountMicro,
          badDebtAmountMicro: latest.bad_debt_amount_micro,
          feeAmountMicro: latest.fee_amount_micro,
          idleAmountMicro: latest.idle_amount_micro,
          openOrderAmountMicro: release.nextOpenOrderAmountMicro,
          positionMarkAmountMicro: latest.position_mark_amount_micro,
          realizedPnlAmountMicro: latest.realized_pnl_amount_micro,
          rewardsAccruedAmountMicro: latest.rewards_accrued_amount_micro,
          unrealizedPnlAmountMicro: latest.unrealized_pnl_amount_micro,
          withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
        })
        const nextSharePriceMicro = calculateSharePriceMicro({
          navAmountMicro: nextNavAmountMicro,
          totalSharesMicro: latest.total_shares_micro,
        })
        const nextStatus = input.status ?? (
          input.errorMessage
            ? LIQUIDITY_BOT_ORDER_STATUS.FAILED
            : LIQUIDITY_BOT_ORDER_STATUS.RELEASED
        )

        const allocationUpdateRows = await tx
          .update(liquidity_pool_strategy_allocations)
          .set({
            used_amount_micro: release.nextUsedAmountMicro,
          })
          .where(eq(liquidity_pool_strategy_allocations.id, allocation.id))
          .returning()
        const orderUpdateRows = await tx
          .update(liquidity_bot_orders)
          .set({
            error_message: input.errorMessage,
            metadata: {
              ...(order.metadata ?? {}),
              ...(input.metadata ?? {}),
            },
            released_amount_micro: order.released_amount_micro + releaseAmountMicro,
            status: nextStatus,
          })
          .where(eq(liquidity_bot_orders.id, order.id))
          .returning()
        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: release.nextAllocatedAmountMicro,
            bad_debt_amount_micro: latest.bad_debt_amount_micro,
            fee_amount_micro: latest.fee_amount_micro,
            idle_amount_micro: latest.idle_amount_micro,
            nav_amount_micro: nextNavAmountMicro,
            open_order_amount_micro: release.nextOpenOrderAmountMicro,
            pool_id: order.pool_id,
            position_mark_amount_micro: latest.position_mark_amount_micro,
            withdrawal_liability_amount_micro: latest.withdrawal_liability_amount_micro,
            realized_pnl_amount_micro: latest.realized_pnl_amount_micro,
            rewards_accrued_amount_micro: latest.rewards_accrued_amount_micro,
            share_price_micro: nextSharePriceMicro,
            source: 'bot_order_release',
            total_shares_micro: latest.total_shares_micro,
            unrealized_pnl_amount_micro: latest.unrealized_pnl_amount_micro,
          })
          .returning()

        await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: 0n,
            metadata: {
              ...(input.metadata ?? {}),
              botOrderId: order.id,
              errorMessage: input.errorMessage ?? null,
              releaseAmountMicro: releaseAmountMicro.toString(),
            },
            nav_amount_micro: nextNavAmountMicro,
            pool_id: order.pool_id,
            share_delta_micro: 0n,
            share_price_micro: nextSharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_ORDER_RELEASE,
          })

        return {
          botOrder: orderUpdateRows[0],
          navSnapshot: navRows[0],
          strategyAllocation: allocationUpdateRows[0],
        }
      })

      return { data: result, error: null }
    })
  },

  async settleBotOrders(input: SettleBotOrdersInput): Promise<QueryResult<{
    botOrders: LiquidityBotOrder[]
    ledgerEntry: LiquidityPoolLedgerEntry
    navSnapshot: LiquidityPoolNavSnapshot
    strategyAllocations: LiquidityStrategyAllocation[]
  }>> {
    if (input.settlements.length === 0) {
      return { data: null, error: 'At least one bot order settlement is required.' }
    }

    const settlementById = new Map<string, BotOrderSettlementInput>()
    for (const settlement of input.settlements) {
      if (settlement.payoutAmountMicro < 0n) {
        return { data: null, error: 'Payout amount must be non-negative.' }
      }
      if (settlementById.has(settlement.botOrderId)) {
        return { data: null, error: 'Duplicate bot order settlement.' }
      }
      settlementById.set(settlement.botOrderId, settlement)
    }

    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const orderIds = Array.from(settlementById.keys())
        const orderRows = await tx
          .select()
          .from(liquidity_bot_orders)
          .where(inArray(liquidity_bot_orders.id, orderIds))
        if (orderRows.length !== orderIds.length) {
          throw new Error('One or more bot orders were not found.')
        }

        for (const order of orderRows) {
          if (order.pool_id !== input.poolId) {
            throw new Error('Bot order settlement pool mismatch.')
          }
          if (order.status !== LIQUIDITY_BOT_ORDER_STATUS.FILLED) {
            throw new Error('Only filled bot orders can be settled.')
          }
          if (order.filled_amount_micro <= 0n) {
            throw new Error('Filled bot order has no filled amount to settle.')
          }
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)

        const allocationDeltas = new Map<string, {
          allocation: LiquidityStrategyAllocation
          exposureReductionMicro: bigint
          usedReductionMicro: bigint
        }>()
        let settledCostBasisMicro = 0n
        let settledPayoutAmountMicro = 0n
        let settledPositionMarkAmountMicro = 0n

        for (const order of orderRows) {
          const allocationRows = await tx
            .select()
            .from(liquidity_pool_strategy_allocations)
            .where(order.strategy_allocation_id
              ? eq(liquidity_pool_strategy_allocations.id, order.strategy_allocation_id)
              : and(
                  eq(liquidity_pool_strategy_allocations.pool_id, order.pool_id),
                  eq(liquidity_pool_strategy_allocations.market_condition_id, order.market_condition_id),
                ))
            .limit(1)
          const allocation = allocationRows[0] ?? null
          if (!allocation) {
            throw new Error('Strategy allocation not found.')
          }

          const settlement = settlementById.get(order.id)
          if (!settlement) {
            throw new Error('Bot order settlement input missing.')
          }

          const positionMarkAmountMicro = order.position_mark_amount_micro > 0n
            ? order.position_mark_amount_micro
            : order.filled_amount_micro
          settledCostBasisMicro += order.filled_amount_micro
          settledPayoutAmountMicro += settlement.payoutAmountMicro
          settledPositionMarkAmountMicro += positionMarkAmountMicro

          const currentDelta = allocationDeltas.get(allocation.id)
          if (currentDelta) {
            currentDelta.exposureReductionMicro += positionMarkAmountMicro
            currentDelta.usedReductionMicro += order.filled_amount_micro
          }
          else {
            allocationDeltas.set(allocation.id, {
              allocation,
              exposureReductionMicro: positionMarkAmountMicro,
              usedReductionMicro: order.filled_amount_micro,
            })
          }
        }

        const targetUnrealizedPnlAmountMicro = input.targetUnrealizedPnlAmountMicro
          ?? latest.unrealized_pnl_amount_micro
        const unrealizedPnlDeltaMicro = targetUnrealizedPnlAmountMicro - latest.unrealized_pnl_amount_micro
        const adjustment = applyPoolNavDelta({
          delta: {
            idleAmountMicro: settledPayoutAmountMicro,
            positionMarkAmountMicro: -settledPositionMarkAmountMicro,
            unrealizedPnlAmountMicro: unrealizedPnlDeltaMicro,
          },
          state: buildNavStateFromSnapshot(latest),
        })

        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: adjustment.next.allocatedAmountMicro,
            bad_debt_amount_micro: adjustment.next.badDebtAmountMicro,
            fee_amount_micro: adjustment.next.feeAmountMicro,
            idle_amount_micro: adjustment.next.idleAmountMicro,
            nav_amount_micro: adjustment.next.navAmountMicro,
            open_order_amount_micro: adjustment.next.openOrderAmountMicro,
            pool_id: input.poolId,
            position_mark_amount_micro: adjustment.next.positionMarkAmountMicro,
            withdrawal_liability_amount_micro: adjustment.next.withdrawalLiabilityAmountMicro,
            realized_pnl_amount_micro: adjustment.next.realizedPnlAmountMicro,
            rewards_accrued_amount_micro: adjustment.next.rewardsAccruedAmountMicro,
            share_price_micro: adjustment.next.sharePriceMicro,
            source: input.source ?? 'bot_order_settlement',
            total_shares_micro: adjustment.next.totalSharesMicro,
            unrealized_pnl_amount_micro: adjustment.next.unrealizedPnlAmountMicro,
          })
          .returning()

        const updatedAllocations: LiquidityStrategyAllocation[] = []
        for (const delta of allocationDeltas.values()) {
          if (delta.exposureReductionMicro > delta.allocation.current_exposure_amount_micro) {
            throw new Error('Bot settlement exceeds strategy exposure.')
          }
          if (delta.usedReductionMicro > delta.allocation.used_amount_micro) {
            throw new Error('Bot settlement exceeds strategy used amount.')
          }

          const allocationRows = await tx
            .update(liquidity_pool_strategy_allocations)
            .set({
              current_exposure_amount_micro: delta.allocation.current_exposure_amount_micro - delta.exposureReductionMicro,
              used_amount_micro: delta.allocation.used_amount_micro - delta.usedReductionMicro,
            })
            .where(eq(liquidity_pool_strategy_allocations.id, delta.allocation.id))
            .returning()

          if (allocationRows[0]) {
            updatedAllocations.push(allocationRows[0])
          }
        }

        const updatedOrders: LiquidityBotOrder[] = []
        for (const order of orderRows) {
          const settlement = settlementById.get(order.id)
          const orderUpdateRows = await tx
            .update(liquidity_bot_orders)
            .set({
              metadata: {
                ...(order.metadata ?? {}),
                ...(input.metadata ?? {}),
                ...(settlement?.metadata ?? {}),
                payoutAmountMicro: settlement?.payoutAmountMicro.toString() ?? '0',
                settledAt: new Date().toISOString(),
              },
              status: LIQUIDITY_BOT_ORDER_STATUS.SETTLED,
              updated_at: new Date(),
            })
            .where(eq(liquidity_bot_orders.id, order.id))
            .returning()

          if (orderUpdateRows[0]) {
            updatedOrders.push(orderUpdateRows[0])
          }
        }

        const ledgerRows = await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: adjustment.amountDeltaMicro,
            metadata: {
              ...(input.metadata ?? {}),
              botOrderIds: orderIds,
              settledCostBasisMicro: settledCostBasisMicro.toString(),
              settledPayoutAmountMicro: settledPayoutAmountMicro.toString(),
              settledPositionMarkAmountMicro: settledPositionMarkAmountMicro.toString(),
              targetUnrealizedPnlAmountMicro: targetUnrealizedPnlAmountMicro.toString(),
              unrealizedPnlDeltaMicro: unrealizedPnlDeltaMicro.toString(),
            },
            nav_amount_micro: adjustment.next.navAmountMicro,
            pool_id: input.poolId,
            share_delta_micro: 0n,
            share_price_micro: adjustment.next.sharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_SETTLEMENT,
          })
          .returning()

        return {
          botOrders: updatedOrders,
          ledgerEntry: ledgerRows[0],
          navSnapshot: navRows[0],
          strategyAllocations: updatedAllocations,
        }
      })

      return { data: result, error: null }
    })
  },

  async deposit(input: DepositLiquidityInput): Promise<QueryResult<{
    ledgerEntry: typeof liquidity_pool_ledger_entries.$inferSelect
    navSnapshot: LiquidityPoolNavSnapshot
    position: LiquidityPoolPosition
    shareAmountMicro: bigint
  }>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const poolRows = await tx
          .select()
          .from(liquidity_pools)
          .where(eq(liquidity_pools.id, input.poolId))
          .limit(1)
        const pool = poolRows[0] ?? null

        if (!pool) {
          throw new Error('Liquidity pool not found.')
        }
        if (pool.status !== LIQUIDITY_POOL_STATUS.ACTIVE) {
          throw new Error('Liquidity pool is not active.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)
        const depositPreview = previewDeposit({
          depositAmountMicro: input.amountMicro,
          navAmountMicro: latest.nav_amount_micro,
          totalSharesMicro: latest.total_shares_micro,
        })
        const now = new Date()
        const lockedUntil = pool.min_lockup_seconds > 0
          ? addSeconds(now, pool.min_lockup_seconds)
          : null

        const existingRows = await tx
          .select()
          .from(liquidity_pool_positions)
          .where(and(
            eq(liquidity_pool_positions.pool_id, input.poolId),
            eq(liquidity_pool_positions.user_id, input.userId),
          ))
          .limit(1)
        const existingPosition = existingRows[0] ?? null

        const positionRows = existingPosition
          ? await tx
              .update(liquidity_pool_positions)
              .set({
                last_deposit_at: now,
                locked_until: lockedUntil ?? existingPosition.locked_until,
                principal_amount_micro: existingPosition.principal_amount_micro + input.amountMicro,
                shares_micro: existingPosition.shares_micro + depositPreview.shareAmountMicro,
              })
              .where(and(
                eq(liquidity_pool_positions.pool_id, input.poolId),
                eq(liquidity_pool_positions.user_id, input.userId),
              ))
              .returning()
          : await tx
              .insert(liquidity_pool_positions)
              .values({
                first_deposit_at: now,
                last_deposit_at: now,
                locked_until: lockedUntil,
                pool_id: input.poolId,
                principal_amount_micro: input.amountMicro,
                shares_micro: depositPreview.shareAmountMicro,
                user_id: input.userId,
              })
              .returning()

        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: latest.allocated_amount_micro,
            bad_debt_amount_micro: latest.bad_debt_amount_micro,
            fee_amount_micro: latest.fee_amount_micro,
            idle_amount_micro: latest.idle_amount_micro + input.amountMicro,
            nav_amount_micro: depositPreview.nextNavAmountMicro,
            open_order_amount_micro: latest.open_order_amount_micro,
            pool_id: input.poolId,
            position_mark_amount_micro: latest.position_mark_amount_micro,
            withdrawal_liability_amount_micro: latest.withdrawal_liability_amount_micro,
            realized_pnl_amount_micro: latest.realized_pnl_amount_micro,
            rewards_accrued_amount_micro: latest.rewards_accrued_amount_micro,
            share_price_micro: depositPreview.nextSharePriceMicro,
            source: 'deposit',
            total_shares_micro: depositPreview.nextTotalSharesMicro,
            unrealized_pnl_amount_micro: latest.unrealized_pnl_amount_micro,
          })
          .returning()

        const ledgerRows = await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: input.amountMicro,
            metadata: input.metadata,
            nav_amount_micro: depositPreview.nextNavAmountMicro,
            pool_id: input.poolId,
            share_delta_micro: depositPreview.shareAmountMicro,
            share_price_micro: depositPreview.nextSharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.DEPOSIT,
            user_id: input.userId,
          })
          .returning()

        return {
          ledgerEntry: ledgerRows[0],
          navSnapshot: navRows[0],
          position: positionRows[0],
          shareAmountMicro: depositPreview.shareAmountMicro,
        }
      })

      return { data: result, error: null }
    })
  },

  async requestWithdrawal(input: RequestWithdrawalInput): Promise<QueryResult<{
    navSnapshot: LiquidityPoolNavSnapshot
    position: LiquidityPoolPosition
    withdrawalRequest: LiquidityWithdrawalRequest
  }>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const poolRows = await tx
          .select()
          .from(liquidity_pools)
          .where(eq(liquidity_pools.id, input.poolId))
          .limit(1)
        const pool = poolRows[0] ?? null
        if (!pool) {
          throw new Error('Liquidity pool not found.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)
        const positionRows = await tx
          .select()
          .from(liquidity_pool_positions)
          .where(and(
            eq(liquidity_pool_positions.pool_id, input.poolId),
            eq(liquidity_pool_positions.user_id, input.userId),
          ))
          .limit(1)
        const position = positionRows[0] ?? null
        if (!position || position.shares_micro <= 0n) {
          throw new Error('No liquidity position found.')
        }

        const plan = planWithdrawal({
          idleAmountMicro: latest.idle_amount_micro,
          idleBufferBps: pool.idle_buffer_bps,
          navAmountMicro: latest.nav_amount_micro,
          requestedAmountMicro: input.requestedAmountMicro,
          requestedSharesMicro: input.requestedSharesMicro,
          totalSharesMicro: latest.total_shares_micro,
          withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
        })
        if (plan.sharesToBurnMicro > position.shares_micro) {
          throw new Error('Withdrawal exceeds available shares.')
        }
        const principalToBurnMicro = calculatePrincipalForShareBurn({
          positionPrincipalAmountMicro: position.principal_amount_micro,
          positionSharesMicro: position.shares_micro,
          sharesToBurnMicro: plan.sharesToBurnMicro,
        })

        const now = new Date()
        const claimableAt = plan.queuedAmountMicro > 0n
          ? addSeconds(now, pool.withdrawal_delay_seconds)
          : now
        const status = plan.queuedAmountMicro > 0n
          ? LIQUIDITY_WITHDRAWAL_STATUS.QUEUED
          : LIQUIDITY_WITHDRAWAL_STATUS.CLAIMABLE
        const nextWithdrawalLiabilityAmountMicro = latest.withdrawal_liability_amount_micro + plan.queuedAmountMicro
        const nextNavAmountMicro = latest.nav_amount_micro > plan.assetsAmountMicro
          ? latest.nav_amount_micro - plan.assetsAmountMicro
          : 0n
        const nextTotalSharesMicro = latest.total_shares_micro > plan.sharesToBurnMicro
          ? latest.total_shares_micro - plan.sharesToBurnMicro
          : 0n
        const nextIdleAmountMicro = latest.idle_amount_micro > plan.immediateAmountMicro
          ? latest.idle_amount_micro - plan.immediateAmountMicro
          : 0n
        const nextSharePriceMicro = calculateSharePriceMicro({
          navAmountMicro: nextNavAmountMicro,
          totalSharesMicro: nextTotalSharesMicro,
        })

        const positionUpdateRows = await tx
          .update(liquidity_pool_positions)
          .set({
            principal_amount_micro: position.principal_amount_micro - principalToBurnMicro,
            shares_micro: position.shares_micro - plan.sharesToBurnMicro,
          })
          .where(and(
            eq(liquidity_pool_positions.pool_id, input.poolId),
            eq(liquidity_pool_positions.user_id, input.userId),
          ))
          .returning()

        const requestRows = await tx
          .insert(liquidity_withdrawal_requests)
          .values({
            assets_amount_micro: plan.assetsAmountMicro,
            claimable_at: claimableAt,
            immediate_amount_micro: plan.immediateAmountMicro,
            metadata: input.metadata,
            pool_id: input.poolId,
            queued_amount_micro: plan.queuedAmountMicro,
            requested_amount_micro: input.requestedAmountMicro,
            share_price_micro: plan.sharePriceMicro,
            shares_to_burn_micro: plan.sharesToBurnMicro,
            status,
            user_id: input.userId,
          })
          .returning()

        await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: -plan.assetsAmountMicro,
            metadata: input.metadata,
            nav_amount_micro: nextNavAmountMicro,
            pool_id: input.poolId,
            share_delta_micro: -plan.sharesToBurnMicro,
            share_price_micro: plan.sharePriceMicro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.WITHDRAWAL_REQUEST,
            user_id: input.userId,
          })

        const navRows = await tx
          .insert(liquidity_pool_nav_snapshots)
          .values({
            allocated_amount_micro: latest.allocated_amount_micro,
            bad_debt_amount_micro: latest.bad_debt_amount_micro,
            fee_amount_micro: latest.fee_amount_micro,
            idle_amount_micro: nextIdleAmountMicro,
            nav_amount_micro: nextNavAmountMicro,
            open_order_amount_micro: latest.open_order_amount_micro,
            pool_id: input.poolId,
            position_mark_amount_micro: latest.position_mark_amount_micro,
            withdrawal_liability_amount_micro: nextWithdrawalLiabilityAmountMicro,
            realized_pnl_amount_micro: latest.realized_pnl_amount_micro,
            rewards_accrued_amount_micro: latest.rewards_accrued_amount_micro,
            share_price_micro: nextSharePriceMicro,
            source: 'withdrawal_request',
            total_shares_micro: nextTotalSharesMicro,
            unrealized_pnl_amount_micro: latest.unrealized_pnl_amount_micro,
          })
          .returning()

        return {
          navSnapshot: navRows[0],
          position: positionUpdateRows[0],
          withdrawalRequest: requestRows[0],
        }
      })

      return { data: result, error: null }
    })
  },

  async completeWithdrawalRequest(
    input: string | CompleteWithdrawalRequestInput,
  ): Promise<QueryResult<LiquidityWithdrawalRequest>> {
    return runQuery(async () => {
      const normalizedInput = typeof input === 'string'
        ? { requestId: input }
        : input
      const completed = await db.transaction(async (tx) => {
        const requestRows = await tx
          .select()
          .from(liquidity_withdrawal_requests)
          .where(eq(liquidity_withdrawal_requests.id, normalizedInput.requestId))
          .limit(1)
        const request = requestRows[0] ?? null

        if (!request) {
          throw new Error('Withdrawal request not found.')
        }
        if (normalizedInput.userId && request.user_id !== normalizedInput.userId) {
          throw new Error('Withdrawal request not found.')
        }
        if (request.status === LIQUIDITY_WITHDRAWAL_STATUS.COMPLETED) {
          return request
        }
        if (request.status === LIQUIDITY_WITHDRAWAL_STATUS.CANCELLED) {
          throw new Error('Withdrawal request is cancelled.')
        }
        if (request.claimable_at > new Date()) {
          throw new Error('Withdrawal request is not claimable yet.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, request.pool_id))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(request.pool_id)
        const adjustment = request.queued_amount_micro > 0n
          ? applyPoolNavDelta({
              delta: {
                idleAmountMicro: -request.queued_amount_micro,
                withdrawalLiabilityAmountMicro: -request.queued_amount_micro,
              },
              state: buildNavStateFromSnapshot(latest),
            })
          : null

        if (adjustment) {
          await tx
            .insert(liquidity_pool_nav_snapshots)
            .values({
              allocated_amount_micro: adjustment.next.allocatedAmountMicro,
              bad_debt_amount_micro: adjustment.next.badDebtAmountMicro,
              fee_amount_micro: adjustment.next.feeAmountMicro,
              idle_amount_micro: adjustment.next.idleAmountMicro,
              nav_amount_micro: adjustment.next.navAmountMicro,
              open_order_amount_micro: adjustment.next.openOrderAmountMicro,
              pool_id: request.pool_id,
              position_mark_amount_micro: adjustment.next.positionMarkAmountMicro,
              withdrawal_liability_amount_micro: adjustment.next.withdrawalLiabilityAmountMicro,
              realized_pnl_amount_micro: adjustment.next.realizedPnlAmountMicro,
              rewards_accrued_amount_micro: adjustment.next.rewardsAccruedAmountMicro,
              share_price_micro: adjustment.next.sharePriceMicro,
              source: 'withdrawal_complete',
              total_shares_micro: adjustment.next.totalSharesMicro,
              unrealized_pnl_amount_micro: adjustment.next.unrealizedPnlAmountMicro,
            })
        }

        const rows = await tx
          .update(liquidity_withdrawal_requests)
          .set({
            completed_at: new Date(),
            status: LIQUIDITY_WITHDRAWAL_STATUS.COMPLETED,
          })
          .where(eq(liquidity_withdrawal_requests.id, normalizedInput.requestId))
          .returning()

        await tx
          .insert(liquidity_pool_ledger_entries)
          .values({
            amount_delta_micro: 0n,
            metadata: {
              ...(normalizedInput.metadata ?? {}),
              queuedAmountMicro: request.queued_amount_micro.toString(),
            },
            nav_amount_micro: adjustment?.next.navAmountMicro ?? latest.nav_amount_micro,
            pool_id: request.pool_id,
            share_delta_micro: 0n,
            share_price_micro: adjustment?.next.sharePriceMicro ?? request.share_price_micro,
            type: LIQUIDITY_LEDGER_ENTRY_TYPE.WITHDRAWAL_COMPLETE,
            user_id: request.user_id,
          })

        return rows[0]
      })

      return { data: completed, error: null }
    })
  },

  async recordReward(input: RecordRewardInput): Promise<QueryResult<typeof liquidity_rewards.$inferSelect>> {
    return runQuery(async () => {
      const rows = await db
        .insert(liquidity_rewards)
        .values({
          metadata: input.metadata,
          period_end: input.periodEnd,
          period_start: input.periodStart,
          pool_id: input.poolId,
          reward_amount_micro: input.rewardAmountMicro ?? 0n,
          reward_points: input.rewardPoints ?? 0n,
          share_time_weight: input.shareTimeWeight,
          status: input.status ?? LIQUIDITY_REWARD_STATUS.ESTIMATED,
          user_id: input.userId,
        })
        .returning()

      return { data: rows[0], error: null }
    })
  },

  async markRewardsPaid(input: MarkRewardsPaidInput): Promise<QueryResult<MarkRewardsPaidResult>> {
    if (!input.rewardIds?.length && !input.poolId && !input.userId) {
      return { data: null, error: 'Reward payment requires rewardIds, poolId, or userId.' }
    }

    return runQuery(async () => {
      const paidAt = input.paidAt ?? new Date()
      const result = await db.transaction(async (tx) => {
        const conditions = buildRewardConditions({
          ...input,
          statuses: input.statuses ?? [LIQUIDITY_REWARD_STATUS.FINAL],
        })
        const rewardRows = await tx
          .select()
          .from(liquidity_rewards)
          .where(and(...conditions))
          .orderBy(liquidity_rewards.period_end, liquidity_rewards.created_at)
          .limit(input.limit ?? 500)

        const updatedRewards: LiquidityReward[] = []
        for (const reward of rewardRows) {
          const metadata = input.metadata === undefined
            ? reward.metadata
            : {
                ...(reward.metadata ?? {}),
                ...(input.metadata ?? {}),
              }
          const rows = await tx
            .update(liquidity_rewards)
            .set({
              metadata,
              paid_at: paidAt,
              status: LIQUIDITY_REWARD_STATUS.PAID,
              updated_at: paidAt,
            })
            .where(eq(liquidity_rewards.id, reward.id))
            .returning()

          if (rows[0]) {
            updatedRewards.push(rows[0])
          }
        }

        const rewardsByPool = new Map<string, LiquidityReward[]>()
        for (const reward of updatedRewards) {
          const rewards = rewardsByPool.get(reward.pool_id) ?? []
          rewards.push(reward)
          rewardsByPool.set(reward.pool_id, rewards)
        }

        for (const [poolId, rewards] of rewardsByPool) {
          const summary = summarizeRewards(rewards)
          await tx
            .insert(liquidity_pool_ledger_entries)
            .values({
              amount_delta_micro: 0n,
              metadata: {
                ...(input.metadata ?? {}),
                paidAt: paidAt.toISOString(),
                rewardCount: summary.totalCount,
                rewardIds: rewards.map(reward => reward.id),
                totalRewardAmountMicro: summary.totalRewardAmountMicro.toString(),
                totalRewardPoints: summary.totalRewardPoints.toString(),
                totalShareTimeWeight: summary.totalShareTimeWeight.toString(),
              },
              pool_id: poolId,
              share_delta_micro: 0n,
              type: LIQUIDITY_LEDGER_ENTRY_TYPE.REWARD_PAYMENT,
            })
        }

        return {
          rewards: updatedRewards,
          summary: summarizeRewards(updatedRewards),
        }
      })

      return { data: result, error: null }
    })
  },

  async calculateAndRecordRewardPeriod(input: CalculateRewardPeriodInput): Promise<QueryResult<Array<typeof liquidity_rewards.$inferSelect>>> {
    return runQuery(async () => {
      const result = await db.transaction(async (tx) => {
        const poolRows = await tx
          .select()
          .from(liquidity_pools)
          .where(eq(liquidity_pools.id, input.poolId))
          .limit(1)
        const pool = poolRows[0] ?? null
        if (!pool) {
          throw new Error('Liquidity pool not found.')
        }

        const ledgerRows = await tx
          .select({
            createdAt: liquidity_pool_ledger_entries.created_at,
            shareDeltaMicro: liquidity_pool_ledger_entries.share_delta_micro,
            userId: liquidity_pool_ledger_entries.user_id,
          })
          .from(liquidity_pool_ledger_entries)
          .where(and(
            eq(liquidity_pool_ledger_entries.pool_id, input.poolId),
            isNotNull(liquidity_pool_ledger_entries.user_id),
            lt(liquidity_pool_ledger_entries.created_at, input.periodEnd),
          ))
        const positionRows = await tx
          .select({
            lockedUntil: liquidity_pool_positions.locked_until,
            userId: liquidity_pool_positions.user_id,
          })
          .from(liquidity_pool_positions)
          .where(eq(liquidity_pool_positions.pool_id, input.poolId))
        const participants = positionRows.map(position => ({
          accountId: position.userId,
          lockMultiplierBps: position.lockedUntil && position.lockedUntil > input.periodStart
            ? pool.lockup_multiplier_bps
            : 10_000,
        }))
        const allocations = calculateRewardPeriodAllocations({
          ledgerEntries: ledgerRows
            .filter(row => row.userId && row.shareDeltaMicro !== 0n)
            .map(row => ({
              accountId: row.userId!,
              at: row.createdAt,
              shareDeltaMicro: row.shareDeltaMicro,
            })),
          participants,
          periodEnd: input.periodEnd,
          periodStart: input.periodStart,
          poolMultiplierBps: pool.pool_multiplier_bps,
          totalRewardMicro: input.totalRewardMicro,
          totalRewardPoints: input.totalRewardPoints ?? 0n,
          utilizationMultiplierBps: input.utilizationMultiplierBps ?? 10_000,
        })
        const status = input.status ?? LIQUIDITY_REWARD_STATUS.ESTIMATED

        if (input.replaceExisting !== false) {
          await tx
            .delete(liquidity_rewards)
            .where(and(
              eq(liquidity_rewards.pool_id, input.poolId),
              eq(liquidity_rewards.period_start, input.periodStart),
              eq(liquidity_rewards.period_end, input.periodEnd),
              eq(liquidity_rewards.status, status),
            ))
        }

        const rewardRows = allocations
          .filter(allocation => (
            allocation.rewardWeight > 0n
            || allocation.rewardAmountMicro > 0n
            || allocation.rewardPoints > 0n
          ))
          .map(allocation => ({
            metadata: {
              ...(input.metadata ?? {}),
              rewardWeight: allocation.rewardWeight.toString(),
              shareSeconds: allocation.shareSeconds.toString(),
            },
            period_end: input.periodEnd,
            period_start: input.periodStart,
            pool_id: input.poolId,
            reward_amount_micro: allocation.rewardAmountMicro,
            reward_points: allocation.rewardPoints,
            share_time_weight: allocation.shareSeconds,
            status,
            user_id: allocation.accountId,
          }))

        if (rewardRows.length === 0) {
          return []
        }

        return await tx
          .insert(liquidity_rewards)
          .values(rewardRows)
          .returning()
      })

      return { data: result, error: null }
    })
  },

  async upsertStrategyAllocation(input: UpsertStrategyAllocationInput): Promise<QueryResult<LiquidityStrategyAllocation>> {
    return runQuery(async () => {
      const allocation = await db.transaction(async (tx) => {
        const poolRows = await tx
          .select()
          .from(liquidity_pools)
          .where(eq(liquidity_pools.id, input.poolId))
          .limit(1)
        const pool = poolRows[0] ?? null
        if (!pool) {
          throw new Error('Liquidity pool not found.')
        }

        const latestRows = await tx
          .select()
          .from(liquidity_pool_nav_snapshots)
          .where(eq(liquidity_pool_nav_snapshots.pool_id, input.poolId))
          .orderBy(desc(liquidity_pool_nav_snapshots.as_of))
          .limit(1)
        const latest = latestRows[0] ?? buildEmptyNavSnapshot(input.poolId)
        const limits = calculateStrategyLimits({
          navAmountMicro: latest.nav_amount_micro,
          singleMarketCapBps: pool.single_market_cap_bps,
          singleOutcomeCapBps: pool.single_outcome_cap_bps,
          utilizationCapBps: pool.utilization_cap_bps,
        })
        const nextStatus = input.status ?? 'active'
        const usedAmountMicro = input.usedAmountMicro ?? 0n
        const currentExposureAmountMicro = input.currentExposureAmountMicro ?? 0n

        if (input.allocatedAmountMicro > limits.maxSingleMarketAllocationMicro) {
          throw new Error('Strategy allocation exceeds the pool single-market limit.')
        }
        if (currentExposureAmountMicro > limits.maxSingleOutcomeExposureMicro) {
          throw new Error('Strategy exposure exceeds the pool single-outcome limit.')
        }
        if (usedAmountMicro > input.allocatedAmountMicro) {
          throw new Error('Strategy used amount cannot exceed allocation.')
        }

        const allocationRows = await tx
          .select({
            allocatedAmountMicro: liquidity_pool_strategy_allocations.allocated_amount_micro,
            currentExposureAmountMicro: liquidity_pool_strategy_allocations.current_exposure_amount_micro,
            marketConditionId: liquidity_pool_strategy_allocations.market_condition_id,
            status: liquidity_pool_strategy_allocations.status,
            usedAmountMicro: liquidity_pool_strategy_allocations.used_amount_micro,
          })
          .from(liquidity_pool_strategy_allocations)
          .where(eq(liquidity_pool_strategy_allocations.pool_id, input.poolId))
        const existingAllocation = allocationRows.find(row => row.marketConditionId === input.marketConditionId) ?? null
        const nextActiveAllocationTotal = calculateNextActiveStrategyAllocationTotal({
          existingAllocations: allocationRows.map(row => ({
            allocatedAmountMicro: row.allocatedAmountMicro,
            marketConditionId: row.marketConditionId,
            status: row.status,
          })),
          marketConditionId: input.marketConditionId,
          nextAllocatedAmountMicro: input.allocatedAmountMicro,
          nextStatus,
        })

        if (nextActiveAllocationTotal > limits.maxBotAllocationMicro) {
          throw new Error('Strategy allocation exceeds the pool total bot allocation limit.')
        }

        const capitalDelta = calculateStrategyAllocationCapitalDelta({
          currentAllocatedAmountMicro: existingAllocation?.allocatedAmountMicro ?? 0n,
          currentStatus: existingAllocation?.status ?? 'paused',
          nextAllocatedAmountMicro: input.allocatedAmountMicro,
          nextStatus,
        })
        if (capitalDelta.allocationDeltaMicro > 0n) {
          const availableIdleMicro = calculateImmediateWithdrawalCapacity({
            idleAmountMicro: latest.idle_amount_micro,
            idleBufferBps: pool.idle_buffer_bps,
            navAmountMicro: latest.nav_amount_micro,
            withdrawalLiabilityAmountMicro: latest.withdrawal_liability_amount_micro,
          })
          if (capitalDelta.allocationDeltaMicro > availableIdleMicro) {
            throw new Error('Strategy allocation exceeds available idle pool liquidity.')
          }
        }

        const rows = await tx
          .insert(liquidity_pool_strategy_allocations)
          .values({
            allocated_amount_micro: input.allocatedAmountMicro,
            current_exposure_amount_micro: currentExposureAmountMicro,
            market_condition_id: input.marketConditionId,
            market_slug: input.marketSlug,
            max_allocation_amount_micro: limits.maxSingleMarketAllocationMicro,
            metadata: input.metadata,
            pool_id: input.poolId,
            status: nextStatus,
            used_amount_micro: usedAmountMicro,
          })
          .onConflictDoUpdate({
            target: [
              liquidity_pool_strategy_allocations.pool_id,
              liquidity_pool_strategy_allocations.market_condition_id,
            ],
            set: {
              allocated_amount_micro: input.allocatedAmountMicro,
              current_exposure_amount_micro: currentExposureAmountMicro,
              market_slug: input.marketSlug,
              max_allocation_amount_micro: limits.maxSingleMarketAllocationMicro,
              metadata: input.metadata,
              status: nextStatus,
              used_amount_micro: usedAmountMicro,
            },
          })
          .returning()

        if (capitalDelta.allocationDeltaMicro !== 0n) {
          const adjustment = applyPoolNavDelta({
            delta: {
              allocatedAmountMicro: capitalDelta.allocationDeltaMicro,
              idleAmountMicro: -capitalDelta.allocationDeltaMicro,
            },
            state: buildNavStateFromSnapshot(latest),
          })

          await tx
            .insert(liquidity_pool_nav_snapshots)
            .values({
              allocated_amount_micro: adjustment.next.allocatedAmountMicro,
              bad_debt_amount_micro: adjustment.next.badDebtAmountMicro,
              fee_amount_micro: adjustment.next.feeAmountMicro,
              idle_amount_micro: adjustment.next.idleAmountMicro,
              nav_amount_micro: adjustment.next.navAmountMicro,
              open_order_amount_micro: adjustment.next.openOrderAmountMicro,
              pool_id: input.poolId,
              position_mark_amount_micro: adjustment.next.positionMarkAmountMicro,
              withdrawal_liability_amount_micro: adjustment.next.withdrawalLiabilityAmountMicro,
              realized_pnl_amount_micro: adjustment.next.realizedPnlAmountMicro,
              rewards_accrued_amount_micro: adjustment.next.rewardsAccruedAmountMicro,
              share_price_micro: adjustment.next.sharePriceMicro,
              source: 'bot_allocation',
              total_shares_micro: adjustment.next.totalSharesMicro,
              unrealized_pnl_amount_micro: adjustment.next.unrealizedPnlAmountMicro,
            })

          await tx
            .insert(liquidity_pool_ledger_entries)
            .values({
              amount_delta_micro: 0n,
              metadata: {
                ...(input.metadata ?? {}),
                allocationDeltaMicro: capitalDelta.allocationDeltaMicro.toString(),
                marketConditionId: input.marketConditionId,
                nextStatus,
              },
              nav_amount_micro: adjustment.next.navAmountMicro,
              pool_id: input.poolId,
              share_delta_micro: 0n,
              share_price_micro: adjustment.next.sharePriceMicro,
              type: LIQUIDITY_LEDGER_ENTRY_TYPE.BOT_ALLOCATION,
            })
        }

        return rows[0]
      })

      return { data: allocation, error: null }
    })
  },
}
