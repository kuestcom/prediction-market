import type { Comment } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  countDirectReplies,
  normalizeCommentReplyTree,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/comment-replies'

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    content: 'hello',
    user_id: 'user-1',
    username: 'user',
    user_avatar: '',
    user_address: '0x3333333333333333333333333333333333333333',
    likes_count: 0,
    replies_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    is_owner: false,
    user_has_liked: false,
    recent_replies: [],
    ...overrides,
  }
}

describe('comment reply helpers', () => {
  it('flattens nested recent replies and infers parent ids from the API tree', () => {
    const normalized = normalizeCommentReplyTree(comment({
      id: 'root',
      recent_replies: [
        comment({
          id: 'reply-1',
          created_at: '2026-01-01T00:01:00.000Z',
          recent_replies: [
            comment({
              id: 'nested-reply-1',
              created_at: '2026-01-01T00:02:00.000Z',
            }),
            comment({
              id: 'nested-reply-2',
              created_at: '2026-01-01T00:03:00.000Z',
            }),
          ],
        }),
      ],
    }))

    expect(normalized.recent_replies?.map(reply => reply.id)).toEqual([
      'reply-1',
      'nested-reply-1',
      'nested-reply-2',
    ])
    expect(normalized.recent_replies?.map(reply => reply.parent_comment_id)).toEqual([
      'root',
      'reply-1',
      'reply-1',
    ])
    expect(normalized.recent_replies?.every(reply => reply.recent_replies?.length === 0)).toBe(true)
    expect(countDirectReplies(normalized)).toBe(1)
  })
})
