-- Performance indexes for sync jobs and event/market lookup paths.
-- Additive only: no schema shape changes, no data mutations.

-- Resolution sync lookups by subgraph question id.
CREATE INDEX IF NOT EXISTS idx_conditions_question_id
  ON conditions (question_id);

-- Resolution sync lookups for neg-risk request mapping.
CREATE INDEX IF NOT EXISTS idx_markets_neg_risk_request_id
  ON markets (neg_risk_request_id)
  WHERE neg_risk_request_id IS NOT NULL;

-- Event status recomputation and related event/market scans by event_id + state.
CREATE INDEX IF NOT EXISTS idx_markets_event_id_active_resolved
  ON markets (event_id, is_active, is_resolved);

-- Volume sync path: active unresolved markets ordered by updated_at.
CREATE INDEX IF NOT EXISTS idx_markets_active_resolved_updated_at
  ON markets (is_active, is_resolved, updated_at);
