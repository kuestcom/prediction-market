import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { and, count, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  identity_audit_events,
  identity_documents,
  identity_fields,
  identity_program_versions,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { assertIdentityCollectionEnabled } from '@/lib/identity/access'
import { IDENTITY_MAX_DOCUMENT_BYTES } from '@/lib/identity/constants'
import {
  decryptIdentityBytes,
  decryptIdentityValue,
  encryptIdentityBytes,
  encryptIdentityValue,
} from '@/lib/identity/encryption'
import { consumeIdentityRateLimit } from '@/lib/identity/rate-limit'
import { IdentityFieldConfigSchema, IdentityRetentionPolicySchema } from '@/lib/identity/schemas'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'
import {
  deletePrivateIdentityObject,
  downloadPrivateIdentityObject,
  uploadPrivateIdentityObject,
} from '@/lib/storage'
import { assertNoActiveIdentityErasure, findActiveIdentityLegalHold } from './identity-privacy'
import 'server-only'

const UploadDocumentSchema = z.object({
  submissionId: z.string().length(26),
  fieldId: z.string().length(26),
}).strict()

function detectDocumentType(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { contentType: 'image/png' as const, extension: 'png' }
  }
  if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes.at(-2) === 0xFF && bytes.at(-1) === 0xD9) {
    return { contentType: 'image/jpeg' as const, extension: 'jpg' }
  }
  if (bytes.length >= 8 && bytes.subarray(0, 5).toString('ascii') === '%PDF-' && bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) {
    return { contentType: 'application/pdf' as const, extension: 'pdf' }
  }
  return null
}

function assertSafeScannerUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || hostname === 'localhost') {
    throw new Error('IDENTITY_SCANNER_URL_INVALID')
  }
  const ipVersion = isIP(hostname)
  if (ipVersion === 4 && /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)) {
    throw new Error('IDENTITY_SCANNER_URL_INVALID')
  }
  if (ipVersion === 6 && (hostname === '::1' || /^(?:fc|fd|fe80)/.test(hostname))) {
    throw new Error('IDENTITY_SCANNER_URL_INVALID')
  }
  return url
}

async function validateDocumentStructure(bytes: Buffer, contentType: string) {
  if (contentType === 'application/pdf') {
    const pageCount = bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0
    if (pageCount < 1 || pageCount > 25) {
      throw new Error('IDENTITY_DOCUMENT_PAGE_COUNT_INVALID')
    }
    return
  }
  const sharpModule = await import('sharp')
  const metadata = await sharpModule.default(bytes, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata()
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
    throw new Error('IDENTITY_DOCUMENT_DIMENSIONS_INVALID')
  }
}

async function scanDocument(bytes: Buffer, contentType: string, filename: string) {
  const scannerUrl = process.env.IDENTITY_DOCUMENT_SCANNER_URL?.trim()
  if (!scannerUrl) {
    throw new Error('IDENTITY_DOCUMENT_SCANNER_NOT_CONFIGURED')
  }
  const url = assertSafeScannerUrl(scannerUrl)
  const body = new FormData()
  body.set('file', new File([Uint8Array.from(bytes)], filename, { type: contentType }))
  const scannerToken = process.env.IDENTITY_DOCUMENT_SCANNER_TOKEN?.trim()
  const response = await fetch(url, {
    method: 'POST',
    headers: scannerToken ? { Authorization: `Bearer ${scannerToken}` } : undefined,
    body,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  const contentTypeHeader = response.headers.get('content-type')?.toLowerCase() ?? ''
  const responseBytes = contentTypeHeader.includes('application/json') ? await readResponseBodyWithLimit(response, 8 * 1024) : null
  const payload = responseBytes
    ? JSON.parse(new TextDecoder().decode(responseBytes)) as { clean?: unknown }
    : null
  if (!response.ok || typeof payload?.clean !== 'boolean') {
    throw new Error('IDENTITY_DOCUMENT_SCAN_FAILED')
  }
  return payload.clean
}

export const IdentityDocumentRepository = {
  async canAdminDownload(documentId: string) {
    const [row] = await db.select({
      retentionExpiresAt: identity_documents.retention_expires_at,
      submissionId: identity_documents.submission_id,
      userId: identity_submissions.user_id,
      fieldConfig: identity_fields.config,
    }).from(identity_documents).innerJoin(identity_submissions, eq(identity_submissions.id, identity_documents.submission_id)).innerJoin(identity_fields, eq(identity_fields.id, identity_documents.field_id)).where(and(
      eq(identity_documents.id, documentId),
      eq(identity_documents.scan_status, 'clean'),
    )).limit(1)
    const config = row ? IdentityFieldConfigSchema.safeParse(row.fieldConfig) : null
    if (!row || !config?.success || config.data.adminVisibility === 'none') {
      return false
    }
    if (!row.retentionExpiresAt || row.retentionExpiresAt > new Date()) {
      return true
    }
    return Boolean(await findActiveIdentityLegalHold(row.userId, [row.submissionId]))
  },

  async upload(userId: string, rawInput: z.input<typeof UploadDocumentSchema>, file: File) {
    await assertIdentityCollectionEnabled()
    await assertNoActiveIdentityErasure(userId)
    await consumeIdentityRateLimit(userId, 'upload_document', 10, 10 * 60 * 1000)
    const input = UploadDocumentSchema.parse(rawInput)
    const [row] = await db.select({
      submission: identity_submissions,
      field: identity_fields,
      retentionPolicy: identity_program_versions.retention_policy,
    }).from(identity_submissions).innerJoin(identity_fields, and(
      eq(identity_fields.id, input.fieldId),
      eq(identity_fields.program_version_id, identity_submissions.program_version_id),
    )).innerJoin(
      identity_program_versions,
      eq(identity_program_versions.id, identity_submissions.program_version_id),
    ).where(and(
      eq(identity_submissions.id, input.submissionId),
      eq(identity_submissions.user_id, userId),
    )).limit(1)
    if (!row || !['draft', 'needs_resubmission'].includes(row.submission.status)) {
      throw new Error('IDENTITY_SUBMISSION_NOT_EDITABLE')
    }
    if (!['file', 'document'].includes(row.field.type) || row.field.storage_mode !== 'local_encrypted') {
      throw new Error('IDENTITY_DOCUMENT_FIELD_INVALID')
    }
    const config = IdentityFieldConfigSchema.parse(row.field.config)
    const retentionPolicy = IdentityRetentionPolicySchema.parse(row.retentionPolicy)
    const [documentCount] = await db.select({ value: count() }).from(identity_documents).where(and(
      eq(identity_documents.submission_id, row.submission.id),
      eq(identity_documents.field_id, row.field.id),
      inArray(identity_documents.scan_status, ['pending', 'clean']),
    ))
    if ((documentCount?.value ?? 0) >= (config.maximumFiles ?? 1)) {
      throw new Error('IDENTITY_DOCUMENT_COUNT_INVALID')
    }
    const maximumBytes = Math.min(config.maximumFileBytes ?? IDENTITY_MAX_DOCUMENT_BYTES, IDENTITY_MAX_DOCUMENT_BYTES)
    if (file.size < 1 || file.size > maximumBytes) {
      throw new Error('IDENTITY_DOCUMENT_SIZE_INVALID')
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const detected = detectDocumentType(bytes)
    if (!detected || !(config.allowedContentTypes ?? ['image/jpeg', 'image/png', 'application/pdf']).includes(detected.contentType)) {
      throw new Error('IDENTITY_DOCUMENT_TYPE_INVALID')
    }
    await validateDocumentStructure(bytes, detected.contentType)

    let storedBytes = bytes
    if (config.stripMetadata === true && detected.contentType !== 'application/pdf') {
      const sharpModule = await import('sharp')
      const image = sharpModule.default(bytes, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate()
      storedBytes = detected.contentType === 'image/png'
        ? await image.png().toBuffer()
        : await image.jpeg({ quality: 95 }).toBuffer()
      if (storedBytes.length > maximumBytes || detectDocumentType(storedBytes)?.contentType !== detected.contentType) {
        throw new Error('IDENTITY_DOCUMENT_SIZE_INVALID')
      }
      await validateDocumentStructure(storedBytes, detected.contentType)
    }

    const contentHash = createHash('sha256').update(storedBytes).digest('base64url')
    const objectKey = `identity-private/${userId.replace(/[^\w-]/g, '_')}/${randomUUID()}.enc`
    const encryptedBody = encryptIdentityBytes(storedBytes, `identity-document:${objectKey}`)
    const encryptedFilename = encryptIdentityValue(file.name.slice(0, 255), `identity-document-filename:${objectKey}`)
    const retentionDays = Math.min(config.retentionDays ?? retentionPolicy.documentDays, retentionPolicy.documentDays)
    const { error: uploadError } = await uploadPrivateIdentityObject(objectKey, encryptedBody.encryptedValue)
    if (uploadError) {
      throw new Error('IDENTITY_DOCUMENT_UPLOAD_FAILED')
    }

    let documentId: string | null = null
    try {
      const [document] = await db.insert(identity_documents).values({
        submission_id: row.submission.id,
        field_id: row.field.id,
        object_key: objectKey,
        original_filename_encrypted: encryptedFilename.encryptedValue,
        declared_content_type: file.type.slice(0, 255) || 'application/octet-stream',
        content_type: detected.contentType,
        size_bytes: storedBytes.length,
        content_hash: contentHash,
        scan_status: 'pending',
        encryption_key_id: encryptedBody.keyId,
        retention_expires_at: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
      }).returning({ id: identity_documents.id })
      documentId = document?.id ?? null
      if (!documentId) {
        throw new Error('IDENTITY_DOCUMENT_CREATE_FAILED')
      }
      const clean = await scanDocument(storedBytes, detected.contentType, file.name)
      await db.update(identity_documents).set({ scan_status: clean ? 'clean' : 'infected' }).where(eq(identity_documents.id, documentId))
      if (!clean) {
        throw new Error('IDENTITY_DOCUMENT_INFECTED')
      }
      await db.insert(identity_audit_events).values({
        actor_user_id: userId,
        subject_user_id: userId,
        action: 'identity.document.uploaded',
        target_type: 'identity_document',
        target_id: documentId,
        result: 'success',
        metadata: { contentType: detected.contentType, sizeBytes: storedBytes.length, scanStatus: 'clean' },
      })
      return { id: documentId, contentType: detected.contentType, sizeBytes: storedBytes.length, scanStatus: 'clean' as const }
    }
    catch (error) {
      const deletion = await deletePrivateIdentityObject(objectKey)
      if (documentId) {
        if (deletion.error) {
          await db.update(identity_documents).set({ scan_status: 'failed' }).where(and(
            eq(identity_documents.id, documentId),
            eq(identity_documents.scan_status, 'pending'),
          ))
        }
        else {
          await db.delete(identity_documents).where(eq(identity_documents.id, documentId))
        }
      }
      throw error
    }
  },

  async download(documentId: string) {
    const [row] = await db.select({
      document: identity_documents,
      userId: identity_submissions.user_id,
    }).from(identity_documents).innerJoin(identity_submissions, eq(identity_submissions.id, identity_documents.submission_id)).where(and(eq(identity_documents.id, documentId), eq(identity_documents.scan_status, 'clean'))).limit(1)
    if (!row) {
      return null
    }
    const document = row.document
    if (document.retention_expires_at && document.retention_expires_at <= new Date()) {
      const hold = await findActiveIdentityLegalHold(row.userId, [document.submission_id])
      if (!hold) {
        return null
      }
    }
    const stored = await downloadPrivateIdentityObject(document.object_key)
    if (!stored.data || stored.error) {
      throw new Error('IDENTITY_DOCUMENT_DOWNLOAD_FAILED')
    }
    const bytes = decryptIdentityBytes(stored.data.toString('utf8'), `identity-document:${document.object_key}`)
    const filename = document.original_filename_encrypted
      ? decryptIdentityValue<string>(document.original_filename_encrypted, `identity-document-filename:${document.object_key}`)
      : 'document'
    return { document, bytes, filename }
  },

  async deleteOwned(userId: string, documentId: string) {
    const [document] = await db.select({ document: identity_documents, submission: identity_submissions })
      .from(identity_documents)
      .innerJoin(identity_submissions, eq(identity_submissions.id, identity_documents.submission_id))
      .where(and(eq(identity_documents.id, documentId), eq(identity_submissions.user_id, userId)))
      .limit(1)
    if (!document || !['draft', 'needs_resubmission'].includes(document.submission.status)) {
      throw new Error('IDENTITY_DOCUMENT_DELETE_FORBIDDEN')
    }
    if (await findActiveIdentityLegalHold(userId, [document.submission.id])) {
      throw new Error('IDENTITY_DOCUMENT_LEGAL_HOLD')
    }
    const result = await deletePrivateIdentityObject(document.document.object_key)
    if (result.error) {
      throw new Error('IDENTITY_DOCUMENT_DELETE_FAILED')
    }
    await db.delete(identity_documents).where(eq(identity_documents.id, documentId))
  },
}
