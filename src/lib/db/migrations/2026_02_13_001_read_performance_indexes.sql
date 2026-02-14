-- Accelerates tag-centric lookups and trigger joins that start from tag_id.
CREATE INDEX IF NOT EXISTS idx_event_tags_tag_id_event_id
  ON event_tags (tag_id, event_id);

-- Supports event-scoped scans ordered by market identity.
CREATE INDEX IF NOT EXISTS idx_markets_event_id_condition_id
  ON markets (event_id, condition_id);

-- Supports cursor lookup for latest processed condition in sync/events.
CREATE INDEX IF NOT EXISTS idx_conditions_updated_at_id
  ON conditions (updated_at DESC, id DESC);
