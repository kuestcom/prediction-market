import type { Comment, User } from '@/types'
import { describe, expect, it } from 'vitest'
import { isCommentOwnedByUser } from '@/app/[locale]/(platform)/event/[slug]/_components/comment-user'

const user = {
  address: '0x1111111111111111111111111111111111111111',
  deposit_wallet_address: '0x2222222222222222222222222222222222222222',
} as User

function comment(overrides: Partial<Comment>): Comment {
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
    ...overrides,
  }
}

describe('comment user helpers', () => {
  it('does not trust the API owner flag without a current user', () => {
    expect(isCommentOwnedByUser(comment({ is_owner: true }), null)).toBe(false)
  })

  it('trusts the API owner flag when a current user is present', () => {
    expect(isCommentOwnedByUser(comment({ is_owner: true }), user)).toBe(true)
  })

  it('detects ownership from the connected base wallet address', () => {
    expect(isCommentOwnedByUser(comment({
      user_address: '0x1111111111111111111111111111111111111111',
    }), user)).toBe(true)
  })

  it('detects ownership from the connected deposit wallet address', () => {
    expect(isCommentOwnedByUser(comment({
      user_proxy_wallet_address: '0x2222222222222222222222222222222222222222',
    }), user)).toBe(true)
  })

  it('does not match a different connected user', () => {
    expect(isCommentOwnedByUser(comment({}), user)).toBe(false)
  })
})
