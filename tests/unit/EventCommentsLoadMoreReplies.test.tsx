import type { Comment } from '@/types'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventCommentsLoadMoreReplies
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventCommentsLoadMoreReplies'

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

describe('eventCommentsLoadMoreReplies', () => {
  it('shows hidden replies when fewer replies are embedded than the total reply count', () => {
    render(
      <EventCommentsLoadMoreReplies
        comment={comment({
          replies_count: 2,
          recent_replies: [comment({ id: 'reply-1' })],
        })}
        onRepliesLoaded={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'View 1 more replies' })).toBeInTheDocument()
  })

  it('hides the control when all replies are embedded', () => {
    const { container } = render(
      <EventCommentsLoadMoreReplies
        comment={comment({
          replies_count: 1,
          recent_replies: [comment({ id: 'reply-1' })],
        })}
        onRepliesLoaded={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('does not count nested replies as hidden direct replies', () => {
    const { container } = render(
      <EventCommentsLoadMoreReplies
        comment={comment({
          replies_count: 1,
          recent_replies: [
            comment({
              id: 'reply-1',
              parent_comment_id: 'comment-1',
            }),
            comment({
              id: 'nested-reply-1',
              parent_comment_id: 'reply-1',
            }),
          ],
        })}
        onRepliesLoaded={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
