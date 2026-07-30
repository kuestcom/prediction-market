import { and, sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it, vi } from 'vitest'

import { buildEndingSoonOrderBy, buildRelatedEventOrderBy, buildResolvedLikeCondition } from '@/lib/db/queries/event'

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

describe('buildEndingSoonOrderBy', () => {
  it('puts future dates first, then recent past dates, then undated events', () => {
    const query = new PgDialect().sqlToQuery(sql.join(buildEndingSoonOrderBy(), sql`, `))
    const normalizedSql = query.sql.replace(/\s+/g, ' ').trim().toLowerCase()

    expect(normalizedSql).toContain(
      'case when "events"."end_date" >= current_timestamp then 0 when "events"."end_date" is not null then 1 else 2 end asc',
    )
    expect(normalizedSql).toContain(
      'case when "events"."end_date" >= current_timestamp then "events"."end_date" end asc',
    )
    expect(normalizedSql).toContain(
      'case when "events"."end_date" < current_timestamp then "events"."end_date" end desc',
    )
  })
})

describe('buildRelatedEventOrderBy', () => {
  it('omits the inactive crypto asset rank instead of generating ORDER BY 0', () => {
    const query = new PgDialect().sqlToQuery(sql.join(buildRelatedEventOrderBy(null, sql`common_tags_count`), sql`, `))
    const normalizedSql = query.sql.replace(/\s+/g, ' ').trim().toLowerCase()

    expect(normalizedSql).toBe('common_tags_count desc, "events"."created_at" desc')
    expect(normalizedSql).not.toContain('0 desc')
  })

  it('keeps the crypto asset rank first when it is active', () => {
    const query = new PgDialect().sqlToQuery(
      sql.join(buildRelatedEventOrderBy(sql<number>`same_asset_rank`, sql`common_tags_count`), sql`, `),
    )
    const normalizedSql = query.sql.replace(/\s+/g, ' ').trim().toLowerCase()

    expect(normalizedSql).toBe('same_asset_rank desc, common_tags_count desc, "events"."created_at" desc')
  })
})
