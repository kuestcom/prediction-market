import { and, eq } from 'drizzle-orm'
import { event_tags, tags } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

export const HIDE_FROM_NEW_TAG_SLUG = 'hide-from-new'
const HIDE_FROM_NEW_TAG_NAME = 'Hide From New'

let cachedHideFromNewTagId: number | null = null

export async function ensureHideFromNewTagId(): Promise<number> {
  if (cachedHideFromNewTagId !== null) {
    return cachedHideFromNewTagId
  }

  const insertedOrUpdatedRows = await db
    .insert(tags)
    .values({
      name: HIDE_FROM_NEW_TAG_NAME,
      slug: HIDE_FROM_NEW_TAG_SLUG,
      is_main_category: false,
      is_hidden: true,
      hide_events: true,
    })
    .onConflictDoUpdate({
      target: [tags.slug],
      set: {
        hide_events: true,
        is_hidden: true,
      },
    })
    .returning({
      id: tags.id,
    })

  const tagId = insertedOrUpdatedRows[0]?.id
  if (!tagId) {
    throw new Error('Failed to ensure hide-from-new tag.')
  }

  cachedHideFromNewTagId = tagId
  return tagId
}

export async function setEventHiddenFromNew(eventId: string, hidden: boolean): Promise<void> {
  const hideFromNewTagId = await ensureHideFromNewTagId()

  if (hidden) {
    await db
      .insert(event_tags)
      .values({
        event_id: eventId,
        tag_id: hideFromNewTagId,
      })
      .onConflictDoNothing({
        target: [event_tags.event_id, event_tags.tag_id],
      })
    return
  }

  await db
    .delete(event_tags)
    .where(and(
      eq(event_tags.event_id, eventId),
      eq(event_tags.tag_id, hideFromNewTagId),
    ))
}
