import { describe, expect, it } from 'bun:test'

import {
  getL2AuthContextCookieName,
  getL2AuthContextCookieNames,
  L2_AUTH_CONTEXT_COOKIE_NAME,
  L2_AUTH_CONTEXT_COOKIE_NAME_SECURE,
} from '@/lib/l2-auth-context'

describe('l2 auth context cookies', () => {
  it('scopes context cookies by user before falling back to legacy names', () => {
    const firstUserCookie = getL2AuthContextCookieName({ secure: false, userId: 'user-a' })
    const secondUserCookie = getL2AuthContextCookieName({ secure: false, userId: 'user-b' })

    expect(firstUserCookie).toMatch(/^kuest_l2_auth_context_[a-f0-9]{24}$/)
    expect(secondUserCookie).toMatch(/^kuest_l2_auth_context_[a-f0-9]{24}$/)
    expect(firstUserCookie).not.toBe(secondUserCookie)

    expect(getL2AuthContextCookieNames('user-a')).toEqual([
      getL2AuthContextCookieName({ secure: true, userId: 'user-a' }),
      firstUserCookie,
      L2_AUTH_CONTEXT_COOKIE_NAME_SECURE,
      L2_AUTH_CONTEXT_COOKIE_NAME,
    ])
  })

  it('keeps legacy cookie names when no user is available', () => {
    expect(getL2AuthContextCookieNames()).toEqual([L2_AUTH_CONTEXT_COOKIE_NAME_SECURE, L2_AUTH_CONTEXT_COOKIE_NAME])
  })
})
