ALTER TABLE subgraph_syncs
  ALTER COLUMN id TYPE INTEGER;

ALTER SEQUENCE IF EXISTS subgraph_syncs_id_seq AS INTEGER;

INSERT INTO subgraph_syncs (service_name, subgraph_name, status, total_processed, error_message)
VALUES
  ('market_sync', 'pnl', 'idle', 0, NULL),
  ('resolution_sync', 'resolution', 'idle', 0, NULL)
ON CONFLICT (service_name, subgraph_name) DO NOTHING;

UPDATE subgraph_syncs
SET
  status = 'idle',
  error_message = NULL,
  updated_at = NOW()
WHERE (service_name, subgraph_name) IN (
  ('market_sync', 'pnl'),
  ('resolution_sync', 'resolution')
);

SELECT setval(
  pg_get_serial_sequence('subgraph_syncs', 'id'),
  COALESCE((SELECT MAX(id) FROM subgraph_syncs), 1),
  true
);
