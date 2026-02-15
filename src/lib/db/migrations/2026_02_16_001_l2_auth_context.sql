-- Add L2 auth context fields for browser-bound authentication
-- Implementation for issue #355: feat: implement browser authentication

ALTER TABLE users 
ADD COLUMN l2_auth_context_id TEXT,
ADD COLUMN l2_auth_context_expires_at TIMESTAMPTZ;

-- Index for efficient context lookups
CREATE INDEX idx_users_l2_auth_context ON users (l2_auth_context_id) WHERE l2_auth_context_id IS NOT NULL;

-- Index for cleanup of expired contexts
CREATE INDEX idx_users_l2_auth_context_expires ON users (l2_auth_context_expires_at) WHERE l2_auth_context_expires_at IS NOT NULL;