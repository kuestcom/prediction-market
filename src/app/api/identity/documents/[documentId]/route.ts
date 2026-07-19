import type { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { IdentityDocumentRepository } from '@/lib/db/queries/identity-document'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import {
  identity_audit_events,
  identity_document_access_tokens,
  identity_documents,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { hasIdentityAdminPermission } from '@/lib/identity/admin-permissions'

async function consumeAdminDownload(documentId: string, token: string) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user?.is_admin || !(await hasIdentityAdminPermission(user, 'identity_view_pii'))) {
    return null
  }
  const [admin] = await db.select({ twoFactorEnabled: users.two_factor_enabled })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  if (!admin?.twoFactorEnabled) {
    return null
  }
  const tokenHash = createHash('sha256').update(token).digest('base64url')
  const [access] = await db.update(identity_document_access_tokens).set({ used_at: new Date() }).where(and(
    eq(identity_document_access_tokens.document_id, documentId),
    eq(identity_document_access_tokens.requested_by_user_id, user.id),
    eq(identity_document_access_tokens.token_hash, tokenHash),
    isNull(identity_document_access_tokens.used_at),
    gt(identity_document_access_tokens.expires_at, new Date()),
  )).returning({ reasonCode: identity_document_access_tokens.reason_code })
  if (!access) {
    return null
  }
  const [owner] = await db.select({ userId: identity_submissions.user_id })
    .from(identity_documents)
    .innerJoin(identity_submissions, eq(identity_submissions.id, identity_documents.submission_id))
    .where(eq(identity_documents.id, documentId))
    .limit(1)
  await db.insert(identity_audit_events).values({
    actor_user_id: user.id,
    subject_user_id: owner?.userId ?? null,
    action: 'identity.document.downloaded',
    target_type: 'identity_document',
    target_id: documentId,
    reason_code: access.reasonCode,
    result: owner ? 'success' : 'denied',
    metadata: {},
  })
  return owner ? user : null
}

interface DocumentRouteContext {
  params: Promise<{ documentId: string }>
}

export async function GET(request: NextRequest, { params }: DocumentRouteContext) {
  const { documentId } = await params
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token.length > 128 || !(await consumeAdminDownload(documentId, token))) {
    return new Response(null, { status: 404 })
  }
  const result = await IdentityDocumentRepository.download(documentId)
  if (!result) {
    return new Response(null, { status: 404 })
  }
  return new Response(result.bytes, {
    headers: {
      'Content-Type': result.document.content_type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'default-src \'none\'; sandbox',
    },
  })
}

export async function DELETE(_request: NextRequest, { params }: DocumentRouteContext) {
  const { documentId } = await params
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return Response.json({ error: 'IDENTITY_UNAUTHENTICATED' }, { status: 401 })
  }
  try {
    await IdentityDocumentRepository.deleteOwned(user.id, documentId)
    return new Response(null, { status: 204 })
  }
  catch {
    return Response.json({ error: 'IDENTITY_DOCUMENT_DELETE_FAILED' }, { status: 400 })
  }
}
