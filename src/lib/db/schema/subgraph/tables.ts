import {
  bigint,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const subgraph_syncs = pgTable(
  'subgraph_syncs',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    service_name: text().notNull(),
    subgraph_name: text().notNull(),
    status: text().default('idle').notNull(),
    total_processed: integer().default(0).notNull(),
    error_message: text(),
    cursor_updated_at: bigint({ mode: 'bigint' }),
    cursor_id: text(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)
