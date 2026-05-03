INSERT INTO settings ("group", key, value)
VALUES (
  'affiliate',
  'builder_taker_fee_bps',
  COALESCE((
    SELECT value
    FROM settings
    WHERE "group" = 'affiliate'
      AND key = 'trade_fee_bps'
  ), '100')
),
('affiliate', 'builder_maker_fee_bps', '0')
ON CONFLICT ("group", key) DO NOTHING;

DELETE FROM settings
WHERE "group" = 'affiliate'
  AND key = 'trade_fee_bps';
