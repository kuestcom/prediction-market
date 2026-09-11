import { sql, type SQL } from 'drizzle-orm'

export function jsonbParam(value: unknown): SQL {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new TypeError('Cannot serialize undefined as JSONB.')
  }

  return sql`${serialized}::jsonb`
}
