import type { Comment } from '@/types'

export function resolveCommentParentId(comment: Pick<Comment, 'parent_comment_id' | 'parentCommentID'>) {
  return comment.parent_comment_id ?? comment.parentCommentID ?? null
}

function commentCreatedAtTime(comment: Comment) {
  const timestamp = Date.parse(comment.created_at)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function collectReplies(replies: Comment[], parentId: string, output: Comment[]) {
  replies.forEach((reply) => {
    const inferredParentId = resolveCommentParentId(reply) ?? parentId
    const nestedReplies = Array.isArray(reply.recent_replies) ? reply.recent_replies : []

    output.push({
      ...reply,
      parent_comment_id: inferredParentId,
      parentCommentID: reply.parentCommentID ?? inferredParentId,
      recent_replies: [],
    })

    collectReplies(nestedReplies, reply.id, output)
  })
}

export function flattenCommentReplies(replies: Comment[] | null | undefined, parentId: string) {
  if (!Array.isArray(replies) || replies.length === 0) {
    return []
  }

  const output: Comment[] = []
  collectReplies(replies, parentId, output)
  return output.sort((first, second) => commentCreatedAtTime(first) - commentCreatedAtTime(second))
}

export function normalizeCommentReplyTree(comment: Comment): Comment {
  return {
    ...comment,
    recent_replies: flattenCommentReplies(comment.recent_replies, comment.id),
  }
}

export function countDirectReplies(comment: Pick<Comment, 'id' | 'recent_replies'>) {
  return (comment.recent_replies ?? []).filter((reply) => {
    const parentId = resolveCommentParentId(reply)
    return !parentId || parentId === comment.id
  }).length
}
