-- ===========================================
-- Resolution sync fields
-- ===========================================

ALTER TABLE conditions
  ADD COLUMN resolution_status TEXT,
  ADD COLUMN resolution_flagged BOOLEAN,
  ADD COLUMN resolution_paused BOOLEAN,
  ADD COLUMN resolution_last_update TIMESTAMPTZ,
  ADD COLUMN resolution_price DECIMAL(20, 6),
  ADD COLUMN resolution_was_disputed BOOLEAN,
  ADD COLUMN resolution_approved BOOLEAN,
  ADD COLUMN resolution_liveness_seconds BIGINT,
  ADD COLUMN resolution_deadline_at TIMESTAMPTZ;

ALTER TABLE subgraph_syncs
  ADD COLUMN cursor_updated_at BIGINT,
  ADD COLUMN cursor_id TEXT;
