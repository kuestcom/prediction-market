import type { Comment } from '@/types'
import { truncateAddress } from '@/lib/formatters'

type CommentUser = Pick<Comment, 'username' | 'user_proxy_wallet_address' | 'user_address'>

function normalizeUsername(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveCommentUserIdentity(comment: CommentUser) {
  const username = normalizeUsername(comment.username)
  const address = comment.user_proxy_wallet_address ?? comment.user_address ?? ''
  const displayName = username || (address ? truncateAddress(address) : 'Anonymous')
  const profileSlug = username || address

  return { displayName, profileSlug }
}
