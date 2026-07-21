ALTER TABLE arbitrage_order_rate_limits
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_arbitrage_order_rate_limits"
  ON arbitrage_order_rate_limits
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
