import { and, eq, exists, not, or, sql } from 'drizzle-orm'
import { conditions, event_sports, event_tags, events, markets, tags } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

const ADMIN_EVENT_ATTENTION_FILTERS = [
  'missing-sports-id',
  'past-due-unresolved',
] as const

export type AdminEventAttentionFilter = (typeof ADMIN_EVENT_ATTENTION_FILTERS)[number]

export function isAdminEventAttentionFilter(value: string | null | undefined): value is AdminEventAttentionFilter {
  return ADMIN_EVENT_ATTENTION_FILTERS.includes(value as AdminEventAttentionFilter)
}

export function buildMissingSportsSourceCondition() {
  const hasSportsTag = exists(
    db
      .select({ event_id: event_tags.event_id })
      .from(event_tags)
      .innerJoin(tags, eq(tags.id, event_tags.tag_id))
      .where(and(
        eq(event_tags.event_id, events.id),
        eq(tags.slug, 'sports'),
      )),
  )
  const hasEsportsTag = exists(
    db
      .select({ event_id: event_tags.event_id })
      .from(event_tags)
      .innerJoin(tags, eq(tags.id, event_tags.tag_id))
      .where(and(
        eq(event_tags.event_id, events.id),
        eq(tags.slug, 'esports'),
      )),
  )
  const hasExpectedSportsSource = exists(
    db
      .select({ event_id: event_sports.event_id })
      .from(event_sports)
      .where(and(
        eq(event_sports.event_id, events.id),
        or(
          and(
            hasEsportsTag,
            eq(event_sports.sports_source_provider, 'pandascore'),
          ),
          and(
            not(hasEsportsTag),
            hasSportsTag,
            eq(event_sports.sports_source_provider, 'thesportsdb'),
          ),
        ),
        sql`(
          TRIM(COALESCE(${event_sports.sports_source_event_id}, '')) <> ''
          OR TRIM(COALESCE(${event_sports.sports_source_game_id}, '')) <> ''
        )`,
      )),
  )

  return and(
    eq(events.status, 'active'),
    eq(events.is_hidden, false),
    or(hasSportsTag, hasEsportsTag),
    not(hasExpectedSportsSource),
  )
}

export function buildPastDueUnresolvedEventCondition() {
  return and(
    eq(events.status, 'active'),
    eq(events.is_hidden, false),
    sql`${events.end_date} < NOW()`,
    exists(
      db
        .select({ market_id: markets.condition_id })
        .from(markets)
        .leftJoin(conditions, eq(conditions.id, markets.condition_id))
        .where(and(
          eq(markets.event_id, events.id),
          eq(markets.is_active, true),
          eq(markets.is_resolved, false),
          sql`COALESCE(${conditions.resolved}, false) = false`,
        )),
    ),
  )
}
