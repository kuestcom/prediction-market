import { sql } from 'drizzle-orm'
import { char, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from '@/lib/db/schema/auth/tables'

export const notifications = pgTable('notifications', {
  id: char('id', { length: 26 })
    .primaryKey()
    .default(sql`generate_ulid()`),
  user_id: char({ length: 26 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  category: text().notNull(),
  title: text().notNull(),
  description: text().notNull(),
  extra_info: text(),
  metadata: jsonb()
    .notNull()
    .default(sql`'{}'::JSONB`),
  link_type: text().notNull().default('none'),
  link_target: text(),
  link_url: text(),
  link_label: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
