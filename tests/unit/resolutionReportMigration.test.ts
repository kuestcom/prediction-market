import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'src/lib/db/migrations/2026_08_02_001_market_resolution_reports_hardening.sql',
)

describe('resolution report hardening migration', () => {
  it('keeps reports attached to their market event and indexes current ordering', async () => {
    const migration = await readFile(migrationPath, 'utf8')

    expect(migration).toContain('FOREIGN KEY (condition_id, event_id)')
    expect(migration).toContain('ON UPDATE CASCADE')
    expect(migration).toContain('(event_id, updated_at DESC, id DESC)')
    expect(migration).toContain('(condition_id, proposed_outcome, updated_at DESC, id DESC)')
    expect(migration).toContain('ALTER COLUMN signature TYPE TEXT')
  })
})
