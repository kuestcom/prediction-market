import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { CommentRepository } from '@/lib/db/queries/comment'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabaseImageUrl } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get('limit') || '20')
    const offset = Number.parseInt(searchParams.get('offset') || '0')
    const sortParam = searchParams.get('sortBy') || 'newest'
    const normalizedSort = sortParam.toLowerCase().replace(/\s+/g, '_')
    const sortBy = normalizedSort === 'most_liked' ? 'most_liked' : 'newest'

    const { data: event, error: eventError } = await EventRepository.getIdBySlug(slug)
    if (!event || eventError) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const user = await UserRepository.getCurrentUser()
    const currentUserId = user?.id

    const { data: comments, error: rootCommentsError } = await CommentRepository.getEventComments(
      event.id,
      limit,
      offset,
      sortBy,
    )
    if (rootCommentsError) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const normalizedComments = (comments ?? []).map((comment: any) => ({
      ...comment,
      user_avatar: comment.user_avatar ? getSupabaseImageUrl(comment.user_avatar) : `https://avatar.vercel.sh/${comment.user_address}.png`,
      recent_replies: Array.isArray(comment.recent_replies) ? comment.recent_replies : [],
    }))

    const userIds = new Set<string>()
    normalizedComments.forEach((comment: any) => {
      if (comment.user_id) {
        userIds.add(String(comment.user_id))
      }
      for (const reply of comment.recent_replies || []) {
        if (reply.user_id) {
          userIds.add(String(reply.user_id))
        }
      }
    })

    const proxyLookup = new Map<string, string | null>()
    const createdAtLookup = new Map<string, string | null>()
    if (userIds.size > 0) {
      const { data: commentUsers } = await UserRepository.getUsersByIds(Array.from(userIds))
      for (const profile of commentUsers ?? []) {
        proxyLookup.set(profile.id, profile.proxy_wallet_address ?? null)
        const createdAt = profile.created_at
          ? new Date(profile.created_at).toISOString()
          : null
        createdAtLookup.set(profile.id, createdAt)
      }
    }

    const commentsWithProfiles = normalizedComments.map((comment: any) => ({
      ...comment,
      user_proxy_wallet_address: proxyLookup.get(String(comment.user_id)) ?? null,
      user_created_at: createdAtLookup.get(String(comment.user_id)) ?? null,
      recent_replies: (comment.recent_replies || []).map((reply: any) => ({
        ...reply,
        user_proxy_wallet_address: proxyLookup.get(String(reply.user_id)) ?? null,
        user_created_at: createdAtLookup.get(String(reply.user_id)) ?? null,
      })),
    }))

    if (!currentUserId || commentsWithProfiles.length === 0) {
      const commentsWithoutLikes = commentsWithProfiles.map((comment: any) => ({
        ...comment,
        is_owner: false,
        user_has_liked: false,
        recent_replies: (comment.recent_replies || [])
          .slice(0, comment.replies_count > 3 ? 3 : comment.replies_count)
          .map((reply: any) => ({
            ...reply,
            user_avatar: reply.user_avatar ? getSupabaseImageUrl(reply.user_avatar) : `https://avatar.vercel.sh/${reply.user_address}.png`,
            is_owner: false,
            user_has_liked: false,
          })),
      }))

      return NextResponse.json(commentsWithoutLikes)
    }

    const commentIds = commentsWithProfiles.map(comment => comment.id)
    const replyIds = commentsWithProfiles.flatMap(comment => comment.recent_replies.map((reply: any) => reply.id))
    const allIds = [...commentIds, ...replyIds]

    if (allIds.length === 0) {
      const commentsWithoutLikes = commentsWithProfiles.map((comment: any) => ({
        ...comment,
        is_owner: currentUserId === comment.user_id,
        user_has_liked: false,
        recent_replies: (comment.recent_replies || [])
          .slice(0, comment.replies_count > 3 ? 3 : comment.replies_count)
          .map((reply: any) => ({
            ...reply,
            user_avatar: reply.user_avatar ? getSupabaseImageUrl(reply.user_avatar) : `https://avatar.vercel.sh/${reply.user_address}.png`,
            is_owner: currentUserId === reply.user_id,
            user_has_liked: false,
          })),
      }))

      return NextResponse.json(commentsWithoutLikes)
    }

    const { data: userLikes, error: userLikesError } = await CommentRepository.getCommentsIdsLikedByUser(currentUserId, allIds)
    if (userLikesError) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const likedIds = new Set((userLikes as unknown as any[])?.map((like: any) => like.comment_id) || [])

    const commentsWithLikeStatus = commentsWithProfiles.map((comment: any) => {
      const baseReplies = comment.recent_replies || []
      const limitedReplies = comment.replies_count > 3
        ? baseReplies.slice(0, 3)
        : baseReplies

      return {
        ...comment,
        is_owner: currentUserId === comment.user_id,
        user_has_liked: likedIds.has(comment.id),
        recent_replies: limitedReplies.map((reply: any) => ({
          ...reply,
          user_avatar: reply.user_avatar ? getSupabaseImageUrl(reply.user_avatar) : `https://avatar.vercel.sh/${reply.user_address}.png`,
          is_owner: currentUserId === reply.user_id,
          user_has_liked: likedIds.has(reply.id),
        })),
      }
    })

    return NextResponse.json(commentsWithLikeStatus)
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
