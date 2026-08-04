import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/2026_08_04_001_resolution_reports_onchain.sql')

describe('on-chain resolution report migration', () => {
  it('keeps only verified proposal identity while preserving existing rows', async () => {
    const migration = await readFile(migrationPath, 'utf8')

    expect(migration).toContain('managed_request_id')
    expect(migration).toContain('proposal_id')
    expect(migration).toContain('transaction_hash')
    expect(migration).toContain('DROP COLUMN IF EXISTS signature')
    expect(migration).toContain("CHECK (proposed_outcome IN ('yes', 'no')) NOT VALID")
    expect(migration).not.toMatch(/\bUPDATE\s+market_resolution_reports\b/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+market_resolution_reports\b/i)
  })
})
