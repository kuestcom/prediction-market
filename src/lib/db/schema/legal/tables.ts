import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

export const terms_of_service_translations = pgTable(
  'terms_of_service_translations',
  {
    locale: text().notNull(),
    content: text().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.locale] }),
  }),
)
