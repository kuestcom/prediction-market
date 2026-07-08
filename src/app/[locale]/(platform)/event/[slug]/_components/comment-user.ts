import type { Comment, User } from '@/types'
import { truncateAddress } from '@/lib/formatters'

type CommentUser = Pick<Comment, 'username' | 'user_proxy_wallet_address' | 'user_address'>
type CommentOwnership = Pick<Comment, 'is_owner' | 'user_proxy_wallet_address' | 'user_address'>
type CommentOwnershipUser = Pick<User, 'address' | 'deposit_wallet_address'> | null | undefined

function normalizeUsername(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCommentAddress(value?: string | null) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null
}

export function resolveCommentUserIdentity(comment: CommentUser) {
  const username = normalizeUsername(comment.username)
  const address = comment.user_proxy_wallet_address ?? comment.user_address ?? ''
  const displayName = username || (address ? truncateAddress(address) : 'Anonymous')
  const profileSlug = username || address

  return { displayName, profileSlug }
}

export function isCommentOwnedByUser(comment: CommentOwnership, user: CommentOwnershipUser) {
  if (!user) {
    return false
  }

  if (comment.is_owner) {
    return true
  }

  const userAddresses = new Set(
    [user.address, user.deposit_wallet_address]
      .map(normalizeCommentAddress)
      .filter((address): address is string => Boolean(address)),
  )

  if (userAddresses.size === 0) {
    return false
  }

  return [comment.user_address, comment.user_proxy_wallet_address]
    .map(normalizeCommentAddress)
    .some(address => Boolean(address && userAddresses.has(address)))
}
