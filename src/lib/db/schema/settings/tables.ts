import { index, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable(
  'settings',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    group: text().notNull(),
    key: text().notNull(),
    value: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
)

export const allowed_market_creators = pgTable(
  'allowed_market_creators',
  {
    wallet_address: text().primaryKey(),
    display_name: text().notNull(),
    source_url: text(),
    source_type: text().notNull(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    sourceTypeIdx: index('idx_allowed_market_creators_source_type').on(table.source_type),
    sourceUrlIdx: index('idx_allowed_market_creators_source_url').on(table.source_url),
  }),
)
