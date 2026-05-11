'use server'

import { updateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { BookmarkRepository } from '@/lib/db/queries/bookmark'
import { UserRepository } from '@/lib/db/queries/user'

export async function getBookmarkStatusAction(eventId: string) {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })
    if (!user) {
      return { data: false, error: null }
    }

    return await BookmarkRepository.isBookmarked(user.id, eventId)
  }
  catch {
    return { data: false, error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function toggleBookmarkAction(eventId: string) {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })
    if (!user) {
      return { data: null, error: 'Unauthenticated.' }
    }

    const result = await BookmarkRepository.toggleBookmark(user.id, eventId)
    if (result.error) {
      return result
    }

    updateTag(cacheTags.events(user.id))

    return {
      data: {
        isBookmarked: result.data,
        userId: user.id,
      },
      error: null,
    }
  }
  catch {
    return { data: null, error: DEFAULT_ERROR_MESSAGE }
  }
}
