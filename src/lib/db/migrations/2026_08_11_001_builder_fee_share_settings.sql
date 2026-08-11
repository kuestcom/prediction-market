DELETE FROM settings
WHERE "group" = 'affiliate'
  AND key IN ('builder_taker_fee_bps', 'builder_maker_fee_bps');
