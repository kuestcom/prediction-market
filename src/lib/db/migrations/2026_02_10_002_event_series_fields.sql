-- ===========================================
-- Event series fields
-- ===========================================

ALTER TABLE events
  ADD COLUMN series_slug TEXT,
  ADD COLUMN series_id TEXT,
  ADD COLUMN series_recurrence TEXT;
