ALTER TABLE event_translations
  ADD COLUMN IF NOT EXISTS additional_context TEXT,
  ADD COLUMN IF NOT EXISTS additional_context_source_hash TEXT,
  ADD COLUMN IF NOT EXISTS additional_context_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS rules_source_hash TEXT,
  ADD COLUMN IF NOT EXISTS rules_is_manual BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO settings ("group", key, value)
VALUES ('i18n', 'rules_translations_enabled', 'false')
ON CONFLICT ("group", key) DO NOTHING;
