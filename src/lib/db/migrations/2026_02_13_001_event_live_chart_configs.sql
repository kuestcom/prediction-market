-- ===========================================
-- Event live chart configuration
-- ===========================================

CREATE TABLE event_live_chart_configs
(
  series_slug    TEXT PRIMARY KEY,
  topic          TEXT        NOT NULL DEFAULT 'crypto_prices_chainlink',
  event_type     TEXT        NOT NULL DEFAULT 'update',
  symbol         TEXT        NOT NULL,
  display_name   TEXT        NOT NULL,
  display_symbol TEXT        NOT NULL,
  line_color     TEXT        NOT NULL DEFAULT '#F59E0B',
  icon_path      TEXT,
  enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_live_chart_configs
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_event_live_chart_configs"
  ON "event_live_chart_configs"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_event_live_chart_configs_updated_at
  BEFORE UPDATE
  ON event_live_chart_configs
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO event_live_chart_configs (
  series_slug,
  topic,
  event_type,
  symbol,
  display_name,
  display_symbol,
  line_color,
  icon_path,
  enabled
)
VALUES (
  'meta-daily-up-down',
  'equity_prices',
  'update',
  'META',
  'Meta',
  'META',
  '#0866FF',
  '/images/live-assets/meta.svg',
  TRUE
);
