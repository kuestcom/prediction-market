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
})
