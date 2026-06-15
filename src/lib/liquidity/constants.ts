export const LIQUIDITY_MICRO_UNIT = 1_000_000n
export const LIQUIDITY_BPS_DENOMINATOR = 10_000n
export const LIQUIDITY_DEFAULT_SHARE_PRICE_MICRO = 10n ** 6n

export const LIQUIDITY_POOL_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed',
} as const

export const LIQUIDITY_POOL_RISK_TIER = {
  CONSERVATIVE: 'conservative',
  STANDARD: 'standard',
  AGGRESSIVE: 'aggressive',
} as const

export const LIQUIDITY_LEDGER_ENTRY_TYPE = {
  DEPOSIT: 'deposit',
  WITHDRAWAL_REQUEST: 'withdrawal_request',
  WITHDRAWAL_COMPLETE: 'withdrawal_complete',
  NAV_ADJUSTMENT: 'nav_adjustment',
  REWARD_ACCRUAL: 'reward_accrual',
  REWARD_PAYMENT: 'reward_payment',
  BOT_ALLOCATION: 'bot_allocation',
  BOT_ORDER_RESERVE: 'bot_order_reserve',
  BOT_ORDER_FILL: 'bot_order_fill',
  BOT_ORDER_RELEASE: 'bot_order_release',
  BOT_SETTLEMENT: 'bot_settlement',
} as const

export const LIQUIDITY_WITHDRAWAL_STATUS = {
  QUEUED: 'queued',
  CLAIMABLE: 'claimable',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export const LIQUIDITY_REWARD_STATUS = {
  ESTIMATED: 'estimated',
  FINAL: 'final',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const

export const LIQUIDITY_BOT_ORDER_STATUS = {
  RESERVED: 'reserved',
  SUBMITTED: 'submitted',
  FILLED: 'filled',
  RELEASED: 'released',
  FAILED: 'failed',
  SETTLED: 'settled',
} as const
