UPDATE users
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{tradingAuth,approvals}',
  '{"completed": false, "updatedAt": null, "version": "deposit-wallet-2026-06-new-exchanges"}'::jsonb,
  true
)
WHERE COALESCE(settings #>> '{tradingAuth,approvals,version}', '') <> 'deposit-wallet-2026-06-new-exchanges'
   OR settings #>> '{tradingAuth,approvals,completed}' = 'true';
