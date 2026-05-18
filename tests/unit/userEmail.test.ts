import { afterEach, describe, expect, it } from 'vitest'
import { hasUsableUserEmail, isWalletPlaceholderEmail } from '@/lib/user-email'

const ORIGINAL_SITE_URL = process.env.SITE_URL

describe('userEmail', () => {
  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.SITE_URL
      return
    }
    process.env.SITE_URL = ORIGINAL_SITE_URL
  })

  it('treats Better Auth SIWE placeholder emails as unusable', () => {
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@demo.kuest.com'

    expect(isWalletPlaceholderEmail(email, ['demo.kuest.com'])).toBe(true)
    expect(hasUsableUserEmail(email, ['demo.kuest.com'])).toBe(false)
  })

  it('does not hard-code placeholder domains', () => {
    delete process.env.SITE_URL
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@demo.kuest.com'

    expect(isWalletPlaceholderEmail(email)).toBe(false)
    expect(hasUsableUserEmail(email)).toBe(true)
  })

  it('matches placeholders against the configured site url hostname by default', () => {
    process.env.SITE_URL = 'tenant.example'
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@tenant.example'

    expect(isWalletPlaceholderEmail(email)).toBe(true)
    expect(hasUsableUserEmail(email)).toBe(false)
  })

  it('does not treat wallet-shaped emails on normal domains as placeholders', () => {
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@gmail.com'

    expect(isWalletPlaceholderEmail(email)).toBe(false)
    expect(hasUsableUserEmail(email)).toBe(true)
  })

  it('matches placeholders against the configured SIWE email domain', () => {
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@example.com'

    expect(isWalletPlaceholderEmail(email)).toBe(false)
    expect(isWalletPlaceholderEmail(email, ['example.com'])).toBe(true)
  })

  it('accepts normal email addresses', () => {
    expect(isWalletPlaceholderEmail('trader@example.com')).toBe(false)
    expect(hasUsableUserEmail('trader@example.com')).toBe(true)
  })

  it('rejects missing and malformed emails', () => {
    expect(hasUsableUserEmail(null)).toBe(false)
    expect(hasUsableUserEmail('not-an-email')).toBe(false)
    expect(hasUsableUserEmail('trader@example..com')).toBe(false)
    expect(hasUsableUserEmail('trader@example_.com')).toBe(false)
  })
})
