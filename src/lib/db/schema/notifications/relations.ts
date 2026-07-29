import { relations } from 'drizzle-orm'

import { users } from '@/lib/db/schema/auth/tables'

import { notifications } from './tables'

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
}))
