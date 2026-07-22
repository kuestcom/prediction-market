import { char, index, pgTable } from 'drizzle-orm/pg-core'
import { users } from '@/lib/db/schema/auth/tables'
import { events } from '@/lib/db/schema/events/tables'

export const bookmarks = pgTable(
  'bookmarks',
  {
    user_id: char('user_id', { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    event_id: char('event_id', { length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  table => ({
    eventIdIdx: index('idx_bookmarks_event_id').on(table.event_id),
  }),
)
