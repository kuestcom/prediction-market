import { getTableColumns } from 'drizzle-orm'
import { createTableRelationsHelpers, extractTablesRelationalConfig } from 'drizzle-orm/relations'
import { describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'

describe('auth schema relations', () => {
  it('exposes pluralized auth relation keys for Better Auth experimental joins', () => {
    const { tables } = extractTablesRelationalConfig(schema, createTableRelationsHelpers)

    expect(tables.sessions.relations.users?.referencedTableName).toBe('users')
    expect(tables.accounts.relations.users?.referencedTableName).toBe('users')
    expect(tables.wallets.relations.users?.referencedTableName).toBe('users')
    expect(tables.two_factors.relations.users?.referencedTableName).toBe('users')
  })

  it('exposes Better Auth two-factor lockout fields', () => {
    const columns = getTableColumns(schema.two_factors)

    expect(columns.failed_verification_count.name).toBe('failed_verification_count')
    expect(columns.failed_verification_count.default).toBe(0)
    expect(columns.failed_verification_count.notNull).toBe(true)
    expect(columns.locked_until.name).toBe('locked_until')
    expect(columns.locked_until.notNull).toBe(false)
  })
})
