INSERT INTO subgraph_syncs (service_name, subgraph_name, status, total_processed, error_message, cursor_id)
VALUES
  ('volume_sync', 'volume', 'idle', 0, NULL, NULL)
ON CONFLICT (service_name, subgraph_name) DO NOTHING;

UPDATE subgraph_syncs
SET
  status = 'idle',
  error_message = NULL,
  updated_at = NOW()
WHERE (service_name, subgraph_name) IN (
  ('volume_sync', 'volume')
);

CREATE INDEX IF NOT EXISTS idx_markets_active_resolved_condition_id
  ON markets (is_active, is_resolved, condition_id);
