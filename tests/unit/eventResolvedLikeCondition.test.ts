import { and, sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'
import { buildResolvedLikeCondition } from '@/lib/db/queries/event'

vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
  unstable_cache: (callback: unknown) => callback,
}))

describe('buildResolvedLikeCondition', () => {
  it('groups the resolved alternatives before applying later filters', () => {
    const condition = and(
      buildResolvedLikeCondition({
        hasAnyMarkets: sql`has_any_markets`,
        hasUnresolvedMarkets: sql`has_unresolved_markets`,
      }),
      sql`has_bitcoin_tag`,
    )
    const query = new PgDialect().sqlToQuery(condition!)

    expect(query.sql).toContain(
      '(("events"."status" = $1 or (has_any_markets and not has_unresolved_markets)) and has_bitcoin_tag)',
    )
    expect(query.params).toEqual(['resolved'])
  })
})
