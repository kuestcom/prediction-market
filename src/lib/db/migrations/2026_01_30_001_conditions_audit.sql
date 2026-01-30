-- ===========================================
-- 1. TABLES
-- ===========================================

CREATE TABLE conditions_audit
(
  id           CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  condition_id CHAR(66)    NOT NULL REFERENCES conditions (id) ON DELETE CASCADE ON UPDATE CASCADE,
  old_values   JSONB       NOT NULL,
  new_values   JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 2. INDEXES
-- ===========================================

CREATE INDEX idx_conditions_audit_condition_id_created_at
  ON conditions_audit (condition_id, created_at DESC);

-- ===========================================
-- 3. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE conditions_audit
  ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. POLICIES
-- ===========================================

CREATE POLICY "service_role_all_conditions_audit" ON "conditions_audit" AS PERMISSIVE FOR ALL TO "service_role" USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- 5. FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION log_conditions_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
AS $$
DECLARE
  old_row  JSONB;
  new_row  JSONB;
  diff_old JSONB;
  diff_new JSONB;
BEGIN
  old_row := to_jsonb(OLD) - 'updated_at';
  new_row := to_jsonb(NEW) - 'updated_at';

  SELECT
    jsonb_object_agg(key, old_value),
    jsonb_object_agg(key, new_value)
  INTO diff_old, diff_new
  FROM (
    SELECT key, value AS old_value, new_row -> key AS new_value
    FROM jsonb_each(old_row)
    WHERE value IS DISTINCT FROM new_row -> key
  ) changes;

  IF diff_new IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO conditions_audit (condition_id, old_values, new_values)
  VALUES (OLD.id, diff_old, diff_new);

  RETURN NEW;
END;
$$;

-- ===========================================
-- 6. TRIGGERS
-- ===========================================

CREATE TRIGGER trigger_log_conditions_update
  AFTER UPDATE
  ON conditions
  FOR EACH ROW
EXECUTE FUNCTION log_conditions_update();
