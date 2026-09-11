import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'

import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql/postgres'
import { bunSqlPgCodecs } from 'drizzle-orm/bun-sql/postgres/codecs'

import { relations } from './db/relations'

type DrizzleDb = BunSQLDatabase<typeof relations>
const MISSING_DATABASE_URL = 'postgres://127.0.0.1:1/kuest-no-database'
const MISSING_DATABASE_ERROR = 'POSTGRES_URL is not set. Configure the database env vars to enable DB features.'

function serializeJsonbParam(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new TypeError('Cannot serialize undefined as JSONB.')
  }

  return serialized
}

// Bun's default JSONB codec only normalizes array parameters. Add the scalar
// normalizer here so every JSONB value is serialized before it reaches Bun SQL.
const postgresCodecs = {
  ...bunSqlPgCodecs,
  jsonb: {
    ...bunSqlPgCodecs.jsonb,
    normalizeParam: serializeJsonbParam,
  },
}

const globalForDb = globalThis as unknown as {
  client: SQL | undefined
  db: DrizzleDb | undefined
  metadataDb: DrizzleDb | undefined
}

function createMetadataDb(): DrizzleDb {
  if (globalForDb.metadataDb) {
    return globalForDb.metadataDb
  }

  const metadataClient = new SQL(MISSING_DATABASE_URL, {
    prepare: false,
    connectionTimeout: 10,
    idleTimeout: 20,
  })
  const metadataDb = drizzle({ client: metadataClient, relations, codecs: postgresCodecs })
  globalForDb.metadataDb = metadataDb

  return metadataDb
}

function createDb(): DrizzleDb {
  const url = process.env.POSTGRES_URL
  if (!url) {
    throw new Error(MISSING_DATABASE_ERROR)
  }

  const client =
    globalForDb.client ??
    new SQL(url, {
      prepare: false,
      connectionTimeout: 10,
      idleTimeout: 20,
    })
  globalForDb.client = client

  const database = globalForDb.db ?? drizzle({ client, relations, codecs: postgresCodecs })
  globalForDb.db = database

  return database
}

function getDb(): DrizzleDb {
  return process.env.POSTGRES_URL?.trim() ? (globalForDb.db ?? createDb()) : createMetadataDb()
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    if (prop === 'then') {
      return undefined
    }

    if (!process.env.POSTGRES_URL?.trim() && prop !== '_') {
      throw new Error(MISSING_DATABASE_ERROR)
    }

    const database = getDb()
    const value = (database as any)[prop]
    return typeof value === 'function' ? value.bind(database) : value
  },
}) as DrizzleDb
