UPDATE users
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{tradingAuth,autoRedeem}',
  '{"completed": false, "updatedAt": null, "version": "deposit-wallet-2026-06-auto-redeem-11735b"}'::jsonb,
  true
)
WHERE settings #> '{tradingAuth,autoRedeem}' IS NOT NULL
  AND (
    COALESCE(settings #>> '{tradingAuth,autoRedeem,version}', '') <> 'deposit-wallet-2026-06-auto-redeem-11735b'
    OR settings #>> '{tradingAuth,autoRedeem,completed}' = 'true'
  );
