import { index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from '@/lib/db/schema/auth/tables'

export const sumsub_applicants = pgTable('sumsub_applicants', {
  user_id: text().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  external_user_id: text().notNull().unique(),
  applicant_id: text().unique(),
  level_name: text().notNull(),
  status: text().notNull().default('not_started'),
  review_status: text(),
  review_answer: text(),
  last_event_created_at: timestamp({ withTimezone: true }),
  last_synced_at: timestamp({ withTimezone: true }),
  approved_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, table => ({
  levelStatusIdx: index('idx_sumsub_applicants_level_status').on(table.level_name, table.status),
}))

export const sumsub_webhook_events = pgTable('sumsub_webhook_events', {
  fingerprint: text().primaryKey(),
  applicant_id: text(),
  event_type: text().notNull(),
  event_created_at: timestamp({ withTimezone: true }),
  processed_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const sumsub_access_token_rate_limits = pgTable('sumsub_access_token_rate_limits', {
  user_id: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text().notNull(),
  window_started_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  request_count: integer().notNull().default(0),
  updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, table => ({
  primaryKey: primaryKey({ columns: [table.user_id, table.scope] }),
}))
