-- Keep program/version references within the same program, narrow erasure to
-- implemented scopes, and protect both sides of child moves after publication.

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_program_versions_program_id_id
  ON identity_program_versions (program_id, id);

ALTER TABLE identity_programs
  DROP CONSTRAINT IF EXISTS identity_programs_active_version_fk;

ALTER TABLE identity_programs
  ADD CONSTRAINT identity_programs_active_version_fk
  FOREIGN KEY (id, active_version_id)
  REFERENCES identity_program_versions (program_id, id)
  ON DELETE SET NULL (active_version_id)
  ON UPDATE CASCADE;

ALTER TABLE identity_submissions
  DROP CONSTRAINT IF EXISTS identity_submissions_program_version_id_fkey,
  DROP CONSTRAINT IF EXISTS identity_submissions_program_version_id_identity_program_versions_id_fk;

ALTER TABLE identity_submissions
  ADD CONSTRAINT identity_submissions_program_version_owner_fk
  FOREIGN KEY (program_id, program_version_id)
  REFERENCES identity_program_versions (program_id, id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

UPDATE identity_erasure_requests
SET scope = 'identity_only'
WHERE scope = 'program';

ALTER TABLE identity_erasure_requests
  DROP CONSTRAINT IF EXISTS identity_erasure_requests_scope_check;

ALTER TABLE identity_erasure_requests
  ADD CONSTRAINT identity_erasure_requests_scope_check
  CHECK (scope IN ('identity_only', 'full_account'));

CREATE OR REPLACE FUNCTION prevent_published_identity_child_mutation()
RETURNS TRIGGER AS $$
DECLARE
  old_version_id CHAR(26);
  new_version_id CHAR(26);
  protected_parent BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'identity_fields' OR TG_TABLE_NAME = 'identity_program_assignments' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_version_id := OLD.program_version_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_version_id := NEW.program_version_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'identity_field_translations' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT f.program_version_id INTO old_version_id
        FROM identity_fields f
        WHERE f.id = OLD.field_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT f.program_version_id INTO new_version_id
        FROM identity_fields f
        WHERE f.id = NEW.field_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'identity_field_options' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT f.program_version_id INTO old_version_id
        FROM identity_fields f
        WHERE f.id = OLD.field_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT f.program_version_id INTO new_version_id
        FROM identity_fields f
        WHERE f.id = NEW.field_id;
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT f.program_version_id INTO old_version_id
        FROM identity_field_options o
        JOIN identity_fields f ON f.id = o.field_id
        WHERE o.id = OLD.option_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT f.program_version_id INTO new_version_id
        FROM identity_field_options o
        JOIN identity_fields f ON f.id = o.field_id
        WHERE o.id = NEW.option_id;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM identity_program_versions
    WHERE id IN (old_version_id, new_version_id)
      AND status IN ('published', 'archived')
  ) INTO protected_parent;

  IF protected_parent THEN
    RAISE EXCEPTION 'Published identity form definitions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
