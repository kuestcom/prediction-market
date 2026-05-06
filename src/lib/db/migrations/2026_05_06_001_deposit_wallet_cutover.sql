DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proxy_wallet_address'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deposit_wallet_address'
  ) THEN
    ALTER TABLE users RENAME COLUMN proxy_wallet_address TO deposit_wallet_address;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proxy_wallet_signature'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deposit_wallet_signature'
  ) THEN
    ALTER TABLE users RENAME COLUMN proxy_wallet_signature TO deposit_wallet_signature;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proxy_wallet_signed_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deposit_wallet_signed_at'
  ) THEN
    ALTER TABLE users RENAME COLUMN proxy_wallet_signed_at TO deposit_wallet_signed_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proxy_wallet_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deposit_wallet_status'
  ) THEN
    ALTER TABLE users RENAME COLUMN proxy_wallet_status TO deposit_wallet_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proxy_wallet_tx_hash'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'deposit_wallet_tx_hash'
  ) THEN
    ALTER TABLE users RENAME COLUMN proxy_wallet_tx_hash TO deposit_wallet_tx_hash;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_proxy_wallet_address')
    AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_deposit_wallet_address')
  THEN
    ALTER INDEX idx_users_proxy_wallet_address RENAME TO idx_users_deposit_wallet_address;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_username_unique'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_unique;
  ELSIF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_unique') THEN
    DROP INDEX users_username_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_deposit_wallet_address
  ON users (LOWER(deposit_wallet_address));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users (LOWER(username));

ALTER TABLE users
  ALTER COLUMN deposit_wallet_status DROP NOT NULL,
  ALTER COLUMN deposit_wallet_status DROP DEFAULT;

UPDATE users
SET
  deposit_wallet_address = NULL,
  deposit_wallet_signature = NULL,
  deposit_wallet_signed_at = NULL,
  deposit_wallet_status = NULL,
  deposit_wallet_tx_hash = NULL,
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb)
      #- '{tradingAuth,relayer}'
      #- '{tradingAuth,clob}'
      #- '{tradingAuth,l2Contexts}',
    '{tradingAuth,approvals}',
    '{"completed": false, "updatedAt": null, "version": "deposit-wallet-2026-05"}'::jsonb,
    true
  );
