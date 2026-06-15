import { relations } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import {
  liquidity_bot_orders,
  liquidity_pool_ledger_entries,
  liquidity_pool_nav_snapshots,
  liquidity_pool_positions,
  liquidity_pool_strategy_allocations,
  liquidity_pools,
  liquidity_rewards,
  liquidity_withdrawal_requests,
} from './tables'

export const liquidityPoolsRelations = relations(liquidity_pools, ({ many }) => ({
  botOrders: many(liquidity_bot_orders),
  ledgerEntries: many(liquidity_pool_ledger_entries),
  navSnapshots: many(liquidity_pool_nav_snapshots),
  positions: many(liquidity_pool_positions),
  rewards: many(liquidity_rewards),
  strategyAllocations: many(liquidity_pool_strategy_allocations),
  withdrawalRequests: many(liquidity_withdrawal_requests),
}))

export const liquidityPoolPositionsRelations = relations(liquidity_pool_positions, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_pool_positions.pool_id],
    references: [liquidity_pools.id],
  }),
  user: one(users, {
    fields: [liquidity_pool_positions.user_id],
    references: [users.id],
  }),
}))

export const liquidityPoolNavSnapshotsRelations = relations(liquidity_pool_nav_snapshots, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_pool_nav_snapshots.pool_id],
    references: [liquidity_pools.id],
  }),
}))

export const liquidityPoolLedgerEntriesRelations = relations(liquidity_pool_ledger_entries, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_pool_ledger_entries.pool_id],
    references: [liquidity_pools.id],
  }),
  user: one(users, {
    fields: [liquidity_pool_ledger_entries.user_id],
    references: [users.id],
  }),
}))

export const liquidityWithdrawalRequestsRelations = relations(liquidity_withdrawal_requests, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_withdrawal_requests.pool_id],
    references: [liquidity_pools.id],
  }),
  user: one(users, {
    fields: [liquidity_withdrawal_requests.user_id],
    references: [users.id],
  }),
}))

export const liquidityRewardsRelations = relations(liquidity_rewards, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_rewards.pool_id],
    references: [liquidity_pools.id],
  }),
  user: one(users, {
    fields: [liquidity_rewards.user_id],
    references: [users.id],
  }),
}))

export const liquidityPoolStrategyAllocationsRelations = relations(liquidity_pool_strategy_allocations, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_pool_strategy_allocations.pool_id],
    references: [liquidity_pools.id],
  }),
}))

export const liquidityBotOrdersRelations = relations(liquidity_bot_orders, ({ one }) => ({
  pool: one(liquidity_pools, {
    fields: [liquidity_bot_orders.pool_id],
    references: [liquidity_pools.id],
  }),
  strategyAllocation: one(liquidity_pool_strategy_allocations, {
    fields: [liquidity_bot_orders.strategy_allocation_id],
    references: [liquidity_pool_strategy_allocations.id],
  }),
}))
