ALTER TABLE accounts
  ADD COLUMN issuer TEXT;

UPDATE accounts
SET issuer = 'local:' || provider_id
WHERE issuer IS NULL;

ALTER TABLE accounts
  ALTER COLUMN issuer SET NOT NULL;

CREATE UNIQUE INDEX idx_accounts_issuer_account_id
  ON accounts (issuer, account_id);
