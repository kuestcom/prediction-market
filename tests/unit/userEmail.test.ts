import { describe, expect, it } from 'vitest'
import { hasUsableUserEmail, isWalletPlaceholderEmail } from '@/lib/user-email'

describe('userEmail', () => {
  it('treats Better Auth SIWE placeholder emails as unusable', () => {
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@demo.kuest.com'

    expect(isWalletPlaceholderEmail(email, ['demo.kuest.com'])).toBe(true)
    expect(hasUsableUserEmail(email, ['demo.kuest.com'])).toBe(false)
  })

  it('does not hard-code placeholder domains', () => {
    const email = '0xbc040c5a56d757986475005f8cde8e41fe3e2486@demo.kuest.com'

    expect(isWalletPlaceholderEmail(email)).toBe(false)
    expect(hasUsableUserEmail(email)).toBe(true)
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
