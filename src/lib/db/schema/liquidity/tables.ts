import { sql } from 'drizzle-orm'
import {
  bigint,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from '@/lib/db/schema/auth/tables'

export const liquidity_pools = pgTable(
  'liquidity_pools',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    slug: text().notNull(),
    name: text().notNull(),
    category_slug: text().notNull(),
    description: text(),
    asset_symbol: text().notNull().default('USDC'),
    asset_decimals: smallint().notNull().default(6),
    status: text().notNull().default('draft'),
    risk_tier: text().notNull().default('standard'),
    pool_multiplier_bps: integer().notNull().default(10_000),
    lockup_multiplier_bps: integer().notNull().default(10_000),
    min_lockup_seconds: integer().notNull().default(0),
    utilization_cap_bps: integer().notNull().default(3_000),
    single_market_cap_bps: integer().notNull().default(500),
    single_outcome_cap_bps: integer().notNull().default(300),
    idle_buffer_bps: integer().notNull().default(3_000),
    withdrawal_delay_seconds: integer().notNull().default(86_400),
    bot_owner_address: text(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    categoryIdx: index('idx_liquidity_pools_category_slug').on(table.category_slug),
    slugUniqueIdx: uniqueIndex('idx_liquidity_pools_slug').on(table.slug),
    statusIdx: index('idx_liquidity_pools_status').on(table.status),
  }),
)

export const liquidity_pool_positions = pgTable(
  'liquidity_pool_positions',
  {
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    shares_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    principal_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    locked_until: timestamp({ withTimezone: true }),
    first_deposit_at: timestamp({ withTimezone: true }),
    last_deposit_at: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.pool_id, table.user_id] }),
    userIdx: index('idx_liquidity_pool_positions_user_id').on(table.user_id),
  }),
)

export const liquidity_pool_nav_snapshots = pgTable(
  'liquidity_pool_nav_snapshots',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    nav_amount_micro: bigint({ mode: 'bigint' }).notNull(),
    idle_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    allocated_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    open_order_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    position_mark_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    withdrawal_liability_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    rewards_accrued_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    realized_pnl_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    unrealized_pnl_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    fee_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    bad_debt_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    total_shares_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    share_price_micro: bigint({ mode: 'bigint' }).notNull(),
    source: text().notNull().default('system'),
    as_of: timestamp({ withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    poolAsOfIdx: index('idx_liquidity_pool_nav_snapshots_pool_as_of').on(table.pool_id, table.as_of),
  }),
)

export const liquidity_pool_ledger_entries = pgTable(
  'liquidity_pool_ledger_entries',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    user_id: text().references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    type: text().notNull(),
    amount_delta_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    share_delta_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    nav_amount_micro: bigint({ mode: 'bigint' }),
    share_price_micro: bigint({ mode: 'bigint' }),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    poolCreatedIdx: index('idx_liquidity_pool_ledger_entries_pool_created').on(table.pool_id, table.created_at),
    userCreatedIdx: index('idx_liquidity_pool_ledger_entries_user_created').on(table.user_id, table.created_at),
  }),
)

export const liquidity_withdrawal_requests = pgTable(
  'liquidity_withdrawal_requests',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    status: text().notNull().default('queued'),
    requested_amount_micro: bigint({ mode: 'bigint' }),
    shares_to_burn_micro: bigint({ mode: 'bigint' }).notNull(),
    assets_amount_micro: bigint({ mode: 'bigint' }).notNull(),
    immediate_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    queued_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    share_price_micro: bigint({ mode: 'bigint' }).notNull(),
    requested_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    claimable_at: timestamp({ withTimezone: true }).notNull(),
    completed_at: timestamp({ withTimezone: true }),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    poolStatusIdx: index('idx_liquidity_withdrawal_requests_pool_status').on(table.pool_id, table.status),
    userStatusIdx: index('idx_liquidity_withdrawal_requests_user_status').on(table.user_id, table.status),
  }),
)

export const liquidity_rewards = pgTable(
  'liquidity_rewards',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    period_start: timestamp({ withTimezone: true }).notNull(),
    period_end: timestamp({ withTimezone: true }).notNull(),
    share_time_weight: numeric({ mode: 'bigint', precision: 78, scale: 0 }).notNull(),
    reward_points: numeric({ mode: 'bigint', precision: 78, scale: 0 }).notNull().default(sql`0`),
    reward_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    status: text().notNull().default('estimated'),
    paid_at: timestamp({ withTimezone: true }),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    poolPeriodIdx: index('idx_liquidity_rewards_pool_period').on(table.pool_id, table.period_start, table.period_end),
    userPeriodIdx: index('idx_liquidity_rewards_user_period').on(table.user_id, table.period_start, table.period_end),
  }),
)

export const liquidity_pool_strategy_allocations = pgTable(
  'liquidity_pool_strategy_allocations',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    market_condition_id: text().notNull(),
    market_slug: text(),
    status: text().notNull().default('active'),
    allocated_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    used_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    max_allocation_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    current_exposure_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    marketIdx: index('idx_liquidity_pool_strategy_allocations_market').on(table.market_condition_id),
    poolMarketUniqueIdx: uniqueIndex('idx_liquidity_pool_strategy_allocations_pool_market').on(
      table.pool_id,
      table.market_condition_id,
    ),
    poolStatusIdx: index('idx_liquidity_pool_strategy_allocations_pool_status').on(table.pool_id, table.status),
  }),
)

export const liquidity_bot_orders = pgTable(
  'liquidity_bot_orders',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    pool_id: char({ length: 26 })
      .notNull()
      .references(() => liquidity_pools.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    strategy_allocation_id: char({ length: 26 })
      .references(() => liquidity_pool_strategy_allocations.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    market_condition_id: text().notNull(),
    market_slug: text(),
    token_id: text(),
    side: text().notNull(),
    order_type: text().notNull().default('limit'),
    status: text().notNull().default('reserved'),
    reserved_amount_micro: bigint({ mode: 'bigint' }).notNull(),
    filled_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    released_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    position_mark_amount_micro: bigint({ mode: 'bigint' }).notNull().default(sql`0`),
    clob_order_id: text(),
    error_message: text(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    clobOrderIdx: uniqueIndex('idx_liquidity_bot_orders_clob_order_id').on(table.clob_order_id),
    marketIdx: index('idx_liquidity_bot_orders_market').on(table.market_condition_id),
    poolStatusIdx: index('idx_liquidity_bot_orders_pool_status').on(table.pool_id, table.status),
    strategyAllocationIdx: index('idx_liquidity_bot_orders_strategy_allocation_id').on(table.strategy_allocation_id),
  }),
)
