import type { QueryResult } from '@/types'
import { and, eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { bookmarks } from '@/lib/db/schema/bookmarks/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

export const BookmarkRepository = {
  async isBookmarked(user_id: string, event_id: string): Promise<QueryResult<boolean>> {
    return runQuery(async () => {
      const existing = await db
        .select({ eventId: bookmarks.event_id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, user_id),
            eq(bookmarks.event_id, event_id),
          ),
        )
        .limit(1)

      return { data: existing.length > 0, error: null }
    })
  },

  async toggleBookmark(user_id: string, event_id: string): Promise<QueryResult<null>> {
    return runQuery(async () => {
      const existing = await db
        .select({ eventId: bookmarks.event_id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.user_id, user_id),
            eq(bookmarks.event_id, event_id),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .delete(bookmarks)
          .where(
            and(
              eq(bookmarks.user_id, user_id),
              eq(bookmarks.event_id, event_id),
            ),
          )
      }
      else {
        await db
          .insert(bookmarks)
          .values({ user_id, event_id })
      }

      updateTag(cacheTags.events(user_id))
      updateTag(cacheTags.event(`${event_id}:${user_id}`))

      return { data: null, error: null }
    })
  },
}
