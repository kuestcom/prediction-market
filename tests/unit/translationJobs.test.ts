import { describe, expect, it } from 'vitest'
import { parseTagJobPayload } from '@/lib/translations/jobs'

describe('translation job payload helpers', () => {
  it('rejects malformed tag ids that parseInt would truncate', () => {
    expect(() => parseTagJobPayload({ tag_id: '12abc', locale: 'es' }, 'tag:bad-suffix')).toThrow(
      'missing or invalid tag_id',
    )
    expect(() => parseTagJobPayload({ tag_id: '1.9', locale: 'es' }, 'tag:decimal')).toThrow(
      'missing or invalid tag_id',
    )
  })

  it('rejects non-decimal integer string formats', () => {
    for (const tagId of ['0x10', '0b101', '0o10', '1e3']) {
      expect(() => parseTagJobPayload({ tag_id: tagId, locale: 'es' }, `tag:${tagId}`)).toThrow(
        'missing or invalid tag_id',
      )
    }
  })

  it('rejects tag ids that cannot be represented as safe integers', () => {
    expect(() => parseTagJobPayload({ tag_id: '9007199254740993', locale: 'es' }, 'tag:unsafe-string')).toThrow(
      'missing or invalid tag_id',
    )
    expect(() => parseTagJobPayload({ tag_id: Number.MAX_SAFE_INTEGER + 1, locale: 'es' }, 'tag:unsafe-number')).toThrow(
      'missing or invalid tag_id',
    )
  })

  it('accepts numeric tag ids encoded as integer strings', () => {
    expect(parseTagJobPayload({ tag_id: '12', locale: 'es' }, 'tag:valid')).toMatchObject({
      tag_id: 12,
      locale: 'es',
    })
  })
})
