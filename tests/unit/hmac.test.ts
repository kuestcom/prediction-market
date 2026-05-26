import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildClobHmacSignature } from '@/lib/hmac'

function sign(secret: string, message: string) {
  return crypto
    .createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(message)
    .digest('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}

describe('buildClobHmacSignature', () => {
  it('excludes query parameters from request signatures', () => {
    const secret = Buffer.from('12345678901234567890123456789012').toString('base64')
    const timestamp = 1710000000
    const requestPath = '/auth/api-keys?metadata=true&includeRevoked=true'

    const signature = buildClobHmacSignature(secret, timestamp, 'GET', requestPath)

    expect(signature).toBe(sign(secret, `${timestamp}GET/auth/api-keys`))
    expect(signature).not.toBe(sign(secret, `${timestamp}GET${requestPath}`))
  })
})
