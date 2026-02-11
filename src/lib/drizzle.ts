import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './db/schema'

type DrizzleDb = PostgresJsDatabase<typeof schema>

const globalForDb = globalThis as unknown as {
  client: postgres.Sql | undefined
  db: DrizzleDb | undefined
}

function createDb(): DrizzleDb {
  const url = process.env.POSTGRES_URL
  if (!url) {
    throw new Error('POSTGRES_URL is not set. Configure the database env vars to enable DB features.')
  }

  const client = globalForDb.client ?? postgres(url, {
    prepare: false,
    max: 3,
    connect_timeout: 10,
    idle_timeout: 20,
  })
  globalForDb.client = client

  const database = globalForDb.db ?? drizzle(client, { schema })
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
