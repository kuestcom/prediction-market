import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('identity migration invariants', () => {
  const migration = fs.readFileSync(path.resolve('src/lib/db/migrations/2026_07_18_001_identity_compliance.sql'), 'utf8')
  const hardeningMigration = fs.readFileSync(path.resolve('src/lib/db/migrations/2026_07_19_001_identity_compliance_hardening.sql'), 'utf8')

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

  it('keeps programs, active versions, and submissions under the same owner', () => {
    expect(hardeningMigration).toContain('idx_identity_program_versions_program_id_id')
    expect(hardeningMigration).toMatch(/FOREIGN KEY \(id, active_version_id\)[\s\S]*REFERENCES identity_program_versions \(program_id, id\)/)
    expect(hardeningMigration).toMatch(/FOREIGN KEY \(program_id, program_version_id\)[\s\S]*REFERENCES identity_program_versions \(program_id, id\)/)
  })

  it('protects old and new parents during moves and removes the unsupported erasure scope', () => {
    expect(hardeningMigration).toContain('old_version_id := OLD.program_version_id')
    expect(hardeningMigration).toContain('new_version_id := NEW.program_version_id')
    expect(hardeningMigration).toMatch(/CHECK \(scope IN \('identity_only', 'full_account'\)\)/)
  })
})
