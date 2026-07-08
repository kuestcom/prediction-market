import { describe, expect, it } from 'vitest'
import { normalizeXHandle, resolveXShareAttribution } from '@/lib/x-handle'

describe('x handle normalization', () => {
  it('normalizes handles from common X and Twitter values', () => {
    expect(normalizeXHandle('@username')).toBe('@username')
    expect(normalizeXHandle('username')).toBe('@username')
    expect(normalizeXHandle('x.com/username')).toBe('@username')
    expect(normalizeXHandle('www.x.com/username')).toBe('@username')
    expect(normalizeXHandle('https://x.com/@username')).toBe('@username')
    expect(normalizeXHandle('https://twitter.com/username')).toBe('@username')
    expect(normalizeXHandle('https://x.com/intent/user?screen_name=username')).toBe('@username')
  })

  it('rejects values that do not identify an X user', () => {
    expect(normalizeXHandle(null)).toBeNull()
    expect(normalizeXHandle('')).toBeNull()
    expect(normalizeXHandle('https://x.com')).toBeNull()
    expect(normalizeXHandle('twitter.com')).toBeNull()
    expect(normalizeXHandle('https://mobile.twitter.com/username/status/123')).toBeNull()
    expect(normalizeXHandle('https://x.com/i/web/status/123')).toBeNull()
    expect(normalizeXHandle('https://x.com/intent/tweet')).toBeNull()
    expect(normalizeXHandle('https://x.com/intent/usernames?screen_name=username')).toBeNull()
    expect(normalizeXHandle('https://x.com/about')).toBeNull()
    expect(normalizeXHandle('https://x.com/help')).toBeNull()
    expect(normalizeXHandle('https://x.com/privacy')).toBeNull()
    expect(normalizeXHandle('https://x.com/jobs')).toBeNull()
    expect(normalizeXHandle('https://example.com/username')).toBeNull()
    expect(normalizeXHandle('@this_username_is_too_long')).toBeNull()
    expect(normalizeXHandle('https://x.com/%E0%A4%A')).toBeNull()
  })

  it('falls back to the configured site name instead of @kuest', () => {
    expect(resolveXShareAttribution({
      siteName: 'Demo Markets',
      twitterLink: 'https://x.com',
    })).toBe('Demo Markets')
  })
})
