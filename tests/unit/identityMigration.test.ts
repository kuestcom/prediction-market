import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('identity migration invariants', () => {
  const migration = fs.readFileSync(path.resolve('src/lib/db/migrations/2026_07_18_001_identity_compliance.sql'), 'utf8')

  it('defaults the module off and protects published definitions', () => {
    expect(migration).toMatch(/VALUES\s+\('identity', 'enabled', 'false'\)/)
    expect(migration).toContain('prevent_published_identity_version_mutation')
    expect(migration).toContain('prevent_published_identity_child_mutation')
  })

  it('enforces idempotency and one-use document access in the database', () => {
    expect(migration).toContain('idx_identity_provider_events_provider_event')
    expect(migration).toContain('idx_identity_outbox_events_idempotency')
    expect(migration).toContain('identity_document_access_tokens')
    expect(migration).toContain('used_at TIMESTAMPTZ')
    expect(migration).toContain('identity_operation_rate_limits')
    expect(migration).toContain('declared_content_type TEXT NOT NULL')
    expect(migration).toContain('secret_rotated_at TIMESTAMPTZ')
  })

  it('supports durable erasure failure and legal-hold states', () => {
    expect(migration).toContain('\'full_account\'')
    expect(migration).toContain('\'needs_attention\'')
    expect(migration).toContain('\'blocked_legal_hold\'')
  })
})
