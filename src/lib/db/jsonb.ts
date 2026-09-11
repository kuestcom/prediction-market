import { sql, type SQL } from 'drizzle-orm'

export function jsonbParam(value: unknown): SQL {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new TypeError('Cannot serialize undefined as JSONB.')
  }

  return sql`${serialized}::jsonb`
}

export function withJsonbParams<T extends object>(value: T, fields: readonly (keyof T & string)[]): T {
  const result = { ...value } as Record<string, unknown>

  for (const field of fields) {
    const fieldValue = result[field]
    if (fieldValue !== null && fieldValue !== undefined) {
      result[field] = jsonbParam(fieldValue)
    }
  }

  return result as T
}
