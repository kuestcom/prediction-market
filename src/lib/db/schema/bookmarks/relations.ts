import { relations } from 'drizzle-orm'

import { users } from '@/lib/db/schema/auth/tables'
import { events } from '@/lib/db/schema/events/tables'

import { bookmarks } from './tables'

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  event: one(events, {
    fields: [bookmarks.event_id],
    references: [events.id],
  }),
  user: one(users, {
    fields: [bookmarks.user_id],
    references: [users.id],
  }),
}))

export const eventsBookmarksRelations = relations(events, ({ many }) => ({
  bookmarks: many(bookmarks),
}))
