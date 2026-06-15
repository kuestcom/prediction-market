-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE liquidity_pools
(
  id                         CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  slug                       TEXT                                          NOT NULL,
  name                       TEXT                                          NOT NULL,
  category_slug              TEXT                                          NOT NULL,
  description                TEXT,
  asset_symbol               TEXT                     DEFAULT 'USDC'       NOT NULL,
  asset_decimals             SMALLINT                 DEFAULT 6            NOT NULL,
  status                     TEXT                     DEFAULT 'draft'      NOT NULL,
  risk_tier                  TEXT                     DEFAULT 'standard'   NOT NULL,
  pool_multiplier_bps        INTEGER                  DEFAULT 10000        NOT NULL,
  lockup_multiplier_bps      INTEGER                  DEFAULT 10000        NOT NULL,
  min_lockup_seconds         INTEGER                  DEFAULT 0            NOT NULL,
  utilization_cap_bps        INTEGER                  DEFAULT 3000         NOT NULL,
  single_market_cap_bps      INTEGER                  DEFAULT 500          NOT NULL,
  single_outcome_cap_bps     INTEGER                  DEFAULT 300          NOT NULL,
  idle_buffer_bps            INTEGER                  DEFAULT 3000         NOT NULL,
  withdrawal_delay_seconds   INTEGER                  DEFAULT 86400        NOT NULL,
  bot_owner_address          TEXT,
  created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_pools_slug_key UNIQUE (slug),
  CONSTRAINT liquidity_pools_status_check CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  CONSTRAINT liquidity_pools_risk_tier_check CHECK (risk_tier IN ('conservative', 'standard', 'aggressive')),
  CONSTRAINT liquidity_pools_asset_decimals_check CHECK (asset_decimals >= 0),
  CONSTRAINT liquidity_pools_pool_multiplier_check CHECK (pool_multiplier_bps >= 0 AND pool_multiplier_bps <= 100000),
  CONSTRAINT liquidity_pools_lockup_multiplier_check CHECK (lockup_multiplier_bps >= 0 AND lockup_multiplier_bps <= 100000),
  CONSTRAINT liquidity_pools_min_lockup_check CHECK (min_lockup_seconds >= 0),
  CONSTRAINT liquidity_pools_utilization_cap_check CHECK (utilization_cap_bps >= 0 AND utilization_cap_bps <= 10000),
  CONSTRAINT liquidity_pools_single_market_cap_check CHECK (single_market_cap_bps >= 0 AND single_market_cap_bps <= 10000),
  CONSTRAINT liquidity_pools_single_outcome_cap_check CHECK (single_outcome_cap_bps >= 0 AND single_outcome_cap_bps <= 10000),
  CONSTRAINT liquidity_pools_idle_buffer_check CHECK (idle_buffer_bps >= 0 AND idle_buffer_bps <= 10000),
  CONSTRAINT liquidity_pools_withdrawal_delay_check CHECK (withdrawal_delay_seconds >= 0)
);

CREATE TABLE liquidity_pool_positions
(
  pool_id                  CHAR(26)                                      NOT NULL,
  user_id                  TEXT                                          NOT NULL,
  shares_micro             BIGINT                   DEFAULT 0            NOT NULL,
  principal_amount_micro   BIGINT                   DEFAULT 0            NOT NULL,
  locked_until             TIMESTAMP WITH TIME ZONE,
  first_deposit_at         TIMESTAMP WITH TIME ZONE,
  last_deposit_at          TIMESTAMP WITH TIME ZONE,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  PRIMARY KEY (pool_id, user_id),
  CONSTRAINT liquidity_pool_positions_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_positions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_positions_shares_check CHECK (shares_micro >= 0),
  CONSTRAINT liquidity_pool_positions_principal_check CHECK (principal_amount_micro >= 0)
);

CREATE TABLE liquidity_pool_nav_snapshots
(
  id                             CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id                        CHAR(26)                                      NOT NULL,
  nav_amount_micro               BIGINT                                        NOT NULL,
  idle_amount_micro              BIGINT                   DEFAULT 0            NOT NULL,
  allocated_amount_micro         BIGINT                   DEFAULT 0            NOT NULL,
  open_order_amount_micro        BIGINT                   DEFAULT 0            NOT NULL,
  position_mark_amount_micro     BIGINT                   DEFAULT 0            NOT NULL,
  withdrawal_liability_amount_micro BIGINT                DEFAULT 0            NOT NULL,
  rewards_accrued_amount_micro   BIGINT                   DEFAULT 0            NOT NULL,
  realized_pnl_amount_micro      BIGINT                   DEFAULT 0            NOT NULL,
  unrealized_pnl_amount_micro    BIGINT                   DEFAULT 0            NOT NULL,
  fee_amount_micro               BIGINT                   DEFAULT 0            NOT NULL,
  bad_debt_amount_micro          BIGINT                   DEFAULT 0            NOT NULL,
  total_shares_micro             BIGINT                   DEFAULT 0            NOT NULL,
  share_price_micro              BIGINT                                        NOT NULL,
  source                         TEXT                     DEFAULT 'system'     NOT NULL,
  as_of                          TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  created_at                     TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_pool_nav_snapshots_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_nav_snapshots_nav_check CHECK (nav_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_idle_check CHECK (idle_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_allocated_check CHECK (allocated_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_open_order_check CHECK (open_order_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_position_mark_check CHECK (position_mark_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_withdrawal_liability_check CHECK (withdrawal_liability_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_rewards_check CHECK (rewards_accrued_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_fee_check CHECK (fee_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_bad_debt_check CHECK (bad_debt_amount_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_total_shares_check CHECK (total_shares_micro >= 0),
  CONSTRAINT liquidity_pool_nav_snapshots_share_price_check CHECK (share_price_micro > 0)
);

CREATE TABLE liquidity_pool_ledger_entries
(
  id                   CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id              CHAR(26)                                      NOT NULL,
  user_id              TEXT,
  type                 TEXT                                          NOT NULL,
  amount_delta_micro   BIGINT                   DEFAULT 0            NOT NULL,
  share_delta_micro    BIGINT                   DEFAULT 0            NOT NULL,
  nav_amount_micro     BIGINT,
  share_price_micro    BIGINT,
  metadata             JSONB,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_pool_ledger_entries_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_ledger_entries_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_ledger_entries_type_check CHECK (
    type IN (
      'deposit',
      'withdrawal_request',
      'withdrawal_complete',
      'nav_adjustment',
      'reward_accrual',
      'reward_payment',
      'bot_allocation',
      'bot_order_reserve',
      'bot_order_fill',
      'bot_order_release',
      'bot_settlement'
    )
  ),
  CONSTRAINT liquidity_pool_ledger_entries_share_price_check CHECK (share_price_micro IS NULL OR share_price_micro > 0),
  CONSTRAINT liquidity_pool_ledger_entries_nav_check CHECK (nav_amount_micro IS NULL OR nav_amount_micro >= 0)
);

CREATE TABLE liquidity_withdrawal_requests
(
  id                       CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id                  CHAR(26)                                      NOT NULL,
  user_id                  TEXT                                          NOT NULL,
  status                   TEXT                     DEFAULT 'queued'      NOT NULL,
  requested_amount_micro   BIGINT,
  shares_to_burn_micro     BIGINT                                        NOT NULL,
  assets_amount_micro      BIGINT                                        NOT NULL,
  immediate_amount_micro   BIGINT                   DEFAULT 0            NOT NULL,
  queued_amount_micro      BIGINT                   DEFAULT 0            NOT NULL,
  share_price_micro        BIGINT                                        NOT NULL,
  requested_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  claimable_at             TIMESTAMP WITH TIME ZONE                      NOT NULL,
  completed_at             TIMESTAMP WITH TIME ZONE,
  metadata                 JSONB,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_withdrawal_requests_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_withdrawal_requests_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_withdrawal_requests_status_check CHECK (status IN ('queued', 'claimable', 'completed', 'cancelled')),
  CONSTRAINT liquidity_withdrawal_requests_requested_check CHECK (requested_amount_micro IS NULL OR requested_amount_micro > 0),
  CONSTRAINT liquidity_withdrawal_requests_shares_check CHECK (shares_to_burn_micro > 0),
  CONSTRAINT liquidity_withdrawal_requests_assets_check CHECK (assets_amount_micro >= 0),
  CONSTRAINT liquidity_withdrawal_requests_immediate_check CHECK (immediate_amount_micro >= 0),
  CONSTRAINT liquidity_withdrawal_requests_queued_check CHECK (queued_amount_micro >= 0),
  CONSTRAINT liquidity_withdrawal_requests_share_price_check CHECK (share_price_micro > 0)
);

CREATE TABLE liquidity_rewards
(
  id                       CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id                  CHAR(26)                                      NOT NULL,
  user_id                  TEXT                                          NOT NULL,
  period_start             TIMESTAMP WITH TIME ZONE                      NOT NULL,
  period_end               TIMESTAMP WITH TIME ZONE                      NOT NULL,
  share_time_weight        NUMERIC(78, 0)                                NOT NULL,
  reward_points            NUMERIC(78, 0)           DEFAULT 0            NOT NULL,
  reward_amount_micro      BIGINT                   DEFAULT 0            NOT NULL,
  status                   TEXT                     DEFAULT 'estimated'  NOT NULL,
  paid_at                  TIMESTAMP WITH TIME ZONE,
  metadata                 JSONB,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_rewards_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_rewards_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_rewards_status_check CHECK (status IN ('estimated', 'final', 'paid', 'cancelled')),
  CONSTRAINT liquidity_rewards_period_check CHECK (period_end > period_start),
  CONSTRAINT liquidity_rewards_weight_check CHECK (share_time_weight >= 0),
  CONSTRAINT liquidity_rewards_points_check CHECK (reward_points >= 0),
  CONSTRAINT liquidity_rewards_amount_check CHECK (reward_amount_micro >= 0)
);

CREATE TABLE liquidity_pool_strategy_allocations
(
  id                              CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id                         CHAR(26)                                      NOT NULL,
  market_condition_id             TEXT                                          NOT NULL,
  market_slug                     TEXT,
  status                          TEXT                     DEFAULT 'active'     NOT NULL,
  allocated_amount_micro          BIGINT                   DEFAULT 0            NOT NULL,
  used_amount_micro               BIGINT                   DEFAULT 0            NOT NULL,
  max_allocation_amount_micro     BIGINT                   DEFAULT 0            NOT NULL,
  current_exposure_amount_micro   BIGINT                   DEFAULT 0            NOT NULL,
  metadata                        JSONB,
  created_at                      TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at                      TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_pool_strategy_allocations_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_pool_strategy_allocations_pool_market_key UNIQUE (pool_id, market_condition_id),
  CONSTRAINT liquidity_pool_strategy_allocations_status_check CHECK (status IN ('active', 'paused', 'closed')),
  CONSTRAINT liquidity_pool_strategy_allocations_allocated_check CHECK (allocated_amount_micro >= 0),
  CONSTRAINT liquidity_pool_strategy_allocations_used_check CHECK (used_amount_micro >= 0),
  CONSTRAINT liquidity_pool_strategy_allocations_max_check CHECK (max_allocation_amount_micro >= 0),
  CONSTRAINT liquidity_pool_strategy_allocations_exposure_check CHECK (current_exposure_amount_micro >= 0)
);

CREATE TABLE liquidity_bot_orders
(
  id                             CHAR(26) PRIMARY KEY DEFAULT generate_ulid() NOT NULL,
  pool_id                        CHAR(26)                                      NOT NULL,
  strategy_allocation_id         CHAR(26),
  market_condition_id            TEXT                                          NOT NULL,
  market_slug                    TEXT,
  token_id                       TEXT,
  side                           TEXT                                          NOT NULL,
  order_type                     TEXT                     DEFAULT 'limit'      NOT NULL,
  status                         TEXT                     DEFAULT 'reserved'   NOT NULL,
  reserved_amount_micro          BIGINT                                        NOT NULL,
  filled_amount_micro            BIGINT                   DEFAULT 0            NOT NULL,
  released_amount_micro          BIGINT                   DEFAULT 0            NOT NULL,
  position_mark_amount_micro     BIGINT                   DEFAULT 0            NOT NULL,
  clob_order_id                  TEXT,
  error_message                  TEXT,
  metadata                       JSONB,
  created_at                     TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  updated_at                     TIMESTAMP WITH TIME ZONE DEFAULT NOW()        NOT NULL,
  CONSTRAINT liquidity_bot_orders_pool_fk FOREIGN KEY (pool_id) REFERENCES liquidity_pools (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT liquidity_bot_orders_strategy_allocation_fk FOREIGN KEY (strategy_allocation_id) REFERENCES liquidity_pool_strategy_allocations (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT liquidity_bot_orders_side_check CHECK (side IN ('buy', 'sell')),
  CONSTRAINT liquidity_bot_orders_status_check CHECK (status IN ('reserved', 'submitted', 'filled', 'released', 'failed', 'settled')),
  CONSTRAINT liquidity_bot_orders_reserved_check CHECK (reserved_amount_micro > 0),
  CONSTRAINT liquidity_bot_orders_filled_check CHECK (filled_amount_micro >= 0),
  CONSTRAINT liquidity_bot_orders_released_check CHECK (released_amount_micro >= 0),
  CONSTRAINT liquidity_bot_orders_position_mark_check CHECK (position_mark_amount_micro >= 0)
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE INDEX idx_liquidity_pools_category_slug ON liquidity_pools (category_slug);
CREATE INDEX idx_liquidity_pools_status ON liquidity_pools (status);

CREATE INDEX idx_liquidity_pool_positions_user_id ON liquidity_pool_positions (user_id);

CREATE INDEX idx_liquidity_pool_nav_snapshots_pool_as_of ON liquidity_pool_nav_snapshots (pool_id, as_of DESC);

CREATE INDEX idx_liquidity_pool_ledger_entries_pool_created ON liquidity_pool_ledger_entries (pool_id, created_at DESC);
CREATE INDEX idx_liquidity_pool_ledger_entries_user_created ON liquidity_pool_ledger_entries (user_id, created_at DESC);

CREATE INDEX idx_liquidity_withdrawal_requests_pool_status ON liquidity_withdrawal_requests (pool_id, status);
CREATE INDEX idx_liquidity_withdrawal_requests_user_status ON liquidity_withdrawal_requests (user_id, status);

CREATE INDEX idx_liquidity_rewards_pool_period ON liquidity_rewards (pool_id, period_start, period_end);
CREATE INDEX idx_liquidity_rewards_user_period ON liquidity_rewards (user_id, period_start, period_end);

CREATE INDEX idx_liquidity_pool_strategy_allocations_market ON liquidity_pool_strategy_allocations (market_condition_id);
CREATE INDEX idx_liquidity_pool_strategy_allocations_pool_status ON liquidity_pool_strategy_allocations (pool_id, status);

CREATE UNIQUE INDEX idx_liquidity_bot_orders_clob_order_id ON liquidity_bot_orders (clob_order_id);
CREATE INDEX idx_liquidity_bot_orders_market ON liquidity_bot_orders (market_condition_id);
CREATE INDEX idx_liquidity_bot_orders_pool_status ON liquidity_bot_orders (pool_id, status);
CREATE INDEX idx_liquidity_bot_orders_strategy_allocation_id ON liquidity_bot_orders (strategy_allocation_id);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE liquidity_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pool_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pool_nav_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pool_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pool_strategy_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_bot_orders ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. SECURITY POLICIES
-- ===========================================

CREATE POLICY service_role_all_liquidity_pools ON liquidity_pools AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_pool_positions ON liquidity_pool_positions AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_pool_nav_snapshots ON liquidity_pool_nav_snapshots AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_pool_ledger_entries ON liquidity_pool_ledger_entries AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_withdrawal_requests ON liquidity_withdrawal_requests AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_rewards ON liquidity_rewards AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_pool_strategy_allocations ON liquidity_pool_strategy_allocations AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY service_role_all_liquidity_bot_orders ON liquidity_bot_orders AS PERMISSIVE FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. TRIGGERS
-- ===========================================

CREATE TRIGGER set_liquidity_pools_updated_at
  BEFORE UPDATE ON liquidity_pools
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_liquidity_pool_positions_updated_at
  BEFORE UPDATE ON liquidity_pool_positions
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_liquidity_withdrawal_requests_updated_at
  BEFORE UPDATE ON liquidity_withdrawal_requests
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_liquidity_rewards_updated_at
  BEFORE UPDATE ON liquidity_rewards
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_liquidity_pool_strategy_allocations_updated_at
  BEFORE UPDATE ON liquidity_pool_strategy_allocations
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_liquidity_bot_orders_updated_at
  BEFORE UPDATE ON liquidity_bot_orders
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
