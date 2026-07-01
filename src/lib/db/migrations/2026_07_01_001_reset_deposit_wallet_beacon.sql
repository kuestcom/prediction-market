DELETE FROM sessions
WHERE user_id IN (
  SELECT id
  FROM users
  WHERE deposit_wallet_address IS NOT NULL
     OR deposit_wallet_signature IS NOT NULL
     OR deposit_wallet_signed_at IS NOT NULL
     OR deposit_wallet_status IS NOT NULL
     OR deposit_wallet_tx_hash IS NOT NULL
     OR COALESCE(settings, '{}'::jsonb) ? 'tradingAuth'
);

UPDATE users
SET
  deposit_wallet_address = NULL,
  deposit_wallet_signature = NULL,
  deposit_wallet_signed_at = NULL,
  deposit_wallet_status = NULL,
  deposit_wallet_tx_hash = NULL,
  settings = CASE
    WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)) = 'object'
      THEN COALESCE(settings, '{}'::jsonb) #- '{tradingAuth}'
    ELSE '{}'::jsonb
  END
WHERE deposit_wallet_address IS NOT NULL
   OR deposit_wallet_signature IS NOT NULL
   OR deposit_wallet_signed_at IS NOT NULL
   OR deposit_wallet_status IS NOT NULL
   OR deposit_wallet_tx_hash IS NOT NULL
   OR COALESCE(settings, '{}'::jsonb) ? 'tradingAuth';
