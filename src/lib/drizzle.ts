import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './db/schema'

const globalForDb = globalThis as unknown as {
  client: postgres.Sql | undefined
}

const client = globalForDb.client ?? postgres(process.env.POSTGRES_URL!, {
  prepare: false,
})

globalForDb.client = client

export const db = drizzle(client, { schema })
