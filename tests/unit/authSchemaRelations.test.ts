import { describe, expect, it } from 'bun:test'
import { getTableColumns } from 'drizzle-orm'

import { relations } from '@/lib/db/relations'
import * as schema from '@/lib/db/schema'

describe('auth schema relations', () => {
  it('exposes pluralized auth relation keys for Better Auth experimental joins', () => {
    expect(relations.sessions.relations.users?.targetTableName).toBe('users')
    expect(relations.accounts.relations.users?.targetTableName).toBe('users')
    expect(relations.wallets.relations.users?.targetTableName).toBe('users')
    expect(relations.two_factors.relations.users?.targetTableName).toBe('users')
  })

  it('exposes Better Auth two-factor lockout fields', () => {
    const columns = getTableColumns(schema.two_factors)

    expect(columns.failed_verification_count.name).toBe('failed_verification_count')
    expect(columns.failed_verification_count.default).toBe(0)
    expect(columns.failed_verification_count.notNull).toBe(true)
    expect(columns.locked_until.name).toBe('locked_until')
    expect(columns.locked_until.notNull).toBe(false)
  })

  it('exposes the Better Auth account issuer field', () => {
    const columns = getTableColumns(schema.accounts)

    expect(columns.issuer.name).toBe('issuer')
    expect(columns.issuer.notNull).toBe(true)
  })
})
