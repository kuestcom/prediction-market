import type { NextRequest } from 'next/server'
import { IdentityDocumentRepository } from '@/lib/db/queries/identity-document'
import { UserRepository } from '@/lib/db/queries/user'
import { IDENTITY_MAX_DOCUMENT_BYTES } from '@/lib/identity/constants'

export async function POST(request: NextRequest) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return Response.json({ error: 'IDENTITY_UNAUTHENTICATED' }, { status: 401 })
  }
  const contentLengthHeader = request.headers.get('content-length')?.trim() ?? ''
  if (!contentLengthHeader) {
    return Response.json({ error: 'IDENTITY_DOCUMENT_SIZE_INVALID' }, { status: 411 })
  }
  if (!/^\d+$/.test(contentLengthHeader)) {
    return Response.json({ error: 'IDENTITY_DOCUMENT_SIZE_INVALID' }, { status: 413 })
  }
  const contentLength = Number(contentLengthHeader)
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > IDENTITY_MAX_DOCUMENT_BYTES + 64 * 1024) {
    return Response.json({ error: 'IDENTITY_DOCUMENT_SIZE_INVALID' }, { status: 413 })
  }
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const submissionId = formData.get('submissionId')
    const fieldId = formData.get('fieldId')
    if (!(file instanceof File) || typeof submissionId !== 'string' || typeof fieldId !== 'string') {
      return Response.json({ error: 'IDENTITY_DOCUMENT_INPUT_INVALID' }, { status: 400 })
    }
    const document = await IdentityDocumentRepository.upload(user.id, { submissionId, fieldId }, file)
    return Response.json({ document }, { status: 201 })
  }
  catch (error) {
    const message = error instanceof Error && /^IDENTITY_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'IDENTITY_DOCUMENT_UPLOAD_FAILED'
    return Response.json({ error: message }, { status: 400 })
  }
}
