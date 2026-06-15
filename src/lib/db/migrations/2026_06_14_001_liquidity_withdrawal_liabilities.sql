ALTER TABLE liquidity_pool_nav_snapshots
  ADD COLUMN IF NOT EXISTS withdrawal_liability_amount_micro BIGINT DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'liquidity_pool_nav_snapshots_withdrawal_liability_check'
  ) THEN
    ALTER TABLE liquidity_pool_nav_snapshots
      ADD CONSTRAINT liquidity_pool_nav_snapshots_withdrawal_liability_check
      CHECK (withdrawal_liability_amount_micro >= 0);
  END IF;
END $$;
