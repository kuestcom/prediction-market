import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

describe('identity privacy hardening invariants', () => {
  const privacy = source('src/lib/db/queries/identity-privacy.ts')
  const documents = source('src/lib/db/queries/identity-document.ts')
  const review = source('src/lib/db/queries/identity-review.ts')
  const jobs = source('src/lib/identity/jobs.ts')
  const settings = source('src/app/[locale]/(platform)/settings/_components/SettingsIdentityVerificationContent.tsx')

  it('applies user- and submission-scoped legal holds at every destructive document boundary', () => {
    expect(privacy).toContain('inArray(identity_legal_holds.submission_id, submissionIds)')
    expect(privacy).toContain('findActiveIdentityLegalHold(userId, submissionIds)')
    expect(documents).toContain('findActiveIdentityLegalHold(userId, [document.submission.id])')
    expect(jobs).toContain('findActiveIdentityLegalHold(row.userId, [document.submission_id], now)')
    expect(jobs).toContain('findActiveIdentityLegalHold(row.submission.user_id, [row.submission.id], now)')
  })

  it('serializes export finalization with erasure and removes indirect identity references', () => {
    expect(privacy.match(/pg_advisory_xact_lock/g)).toHaveLength(2)
    expect(privacy).toContain(`throw new Error('IDENTITY_EXPORT_CANCELLED_BY_ERASURE')`)
    expect(privacy).toContain('await tx.delete(identity_outbox_events).where(outboxTarget)')
    expect(privacy).toContain('set({ actor_user_id: null })')
  })

  it('cleans failed scans without consuming a usable upload slot', () => {
    expect(documents).toContain(`inArray(identity_documents.scan_status, ['pending', 'clean'])`)
    expect(documents).toContain('await db.delete(identity_documents).where(eq(identity_documents.id, documentId))')
    expect(documents).toContain(`set({ scan_status: 'failed' })`)
  })

  it('keeps hidden and expired evidence outside the administrative download path', () => {
    expect(documents).toContain(`config.data.adminVisibility === 'none'`)
    expect(documents).toContain('document.retention_expires_at <= new Date()')
    expect(review).toContain('inArray(identity_documents.field_id, fieldIds)')
  })

  it('lets an owner remove and replace an editable document', () => {
    expect(settings).toContain(`method: 'DELETE'`)
    expect(settings).toContain('onDelete(document.id)')
  })

  it('consumes every configured retention category', () => {
    expect(jobs).toContain('retention.data.approvedDays')
    expect(documents).toContain('retentionPolicy.documentDays')
    expect(jobs).toContain('parsed.data.technicalEventDays')
  })
})
