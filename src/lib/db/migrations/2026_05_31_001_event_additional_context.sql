ALTER TABLE events
  ADD COLUMN IF NOT EXISTS additional_context TEXT,
  ADD COLUMN IF NOT EXISTS additional_context_updated_at TIMESTAMPTZ;
