'use server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { BookmarkRepository } from '@/lib/db/queries/bookmark'
import { UserRepository } from '@/lib/db/queries/user'

export async function getBookmarkStatusAction(eventId: string) {
  try {
    const user = await UserRepository.getCurrentUser()
    if (!user) {
      return { data: false, error: null }
    }

    return await BookmarkRepository.isBookmarked(user.id, eventId)
  }
  catch {
    return { data: false, error: DEFAULT_ERROR_MESSAGE }
  }
}
