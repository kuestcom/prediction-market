import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'

import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql/postgres'

import { relations } from './db/relations'

type DrizzleDb = BunSQLDatabase<typeof relations>

const globalForDb = globalThis as unknown as {
  client: SQL | undefined
  db: DrizzleDb | undefined
}

function createDb(): DrizzleDb {
  const url = process.env.POSTGRES_URL
  if (!url) {
    throw new Error('POSTGRES_URL is not set. Configure the database env vars to enable DB features.')
  }

  const client =
    globalForDb.client ??
    new SQL(url, {
      prepare: false,
      connectionTimeout: 10,
      idleTimeout: 20,
    })
  globalForDb.client = client

  const database = globalForDb.db ?? drizzle({ client, relations })
  globalForDb.db = database

  return database
}

function getDb(): DrizzleDb {
  return globalForDb.db ?? createDb()
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    if (prop === 'then') {
      return undefined
    }
    const database = getDb()
    const value = (database as any)[prop]
    return typeof value === 'function' ? value.bind(database) : value
  },
}) as DrizzleDb
