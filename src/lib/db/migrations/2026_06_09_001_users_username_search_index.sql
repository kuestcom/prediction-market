CREATE INDEX IF NOT EXISTS idx_users_username_lower_gin_trgm
  ON users USING GIN (LOWER(username) gin_trgm_ops);
