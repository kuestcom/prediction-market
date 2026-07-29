import { and, desc, eq } from 'drizzle-orm'
import { cacheTag, updateTag } from 'next/cache'

import type { QueryResult } from '@/types'

import { cacheTags } from '@/lib/cache-tags'
import { notifications } from '@/lib/db/schema/notifications/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

export const NotificationRepository = {
  async getByUserId(user_id: string): Promise<QueryResult<(typeof notifications.$inferSelect)[]>> {
    'use cache'
    cacheTag(cacheTags.notifications(user_id))

    return runQuery(async () => {
      const data = await db
        .select()
        .from(notifications)
        .where(eq(notifications.user_id, user_id))
        .orderBy(desc(notifications.created_at))

      return { data, error: null }
    })
  },

  async deleteById(notificationId: string, user_id: string): Promise<QueryResult<null>> {
    return runQuery(async () => {
      await db
        .delete(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.user_id, user_id)))

      updateTag(cacheTags.notifications(user_id))

      return { data: null, error: null }
    })
  },
}
