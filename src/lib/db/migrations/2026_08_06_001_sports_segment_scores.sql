ALTER TABLE event_sports
  ADD COLUMN IF NOT EXISTS sports_segment_scores JSONB;
