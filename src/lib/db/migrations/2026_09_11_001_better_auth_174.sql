DROP INDEX IF EXISTS idx_accounts_issuer_account_id;

ALTER TABLE accounts
  ALTER COLUMN issuer DROP NOT NULL;
