import { describe, expect, it } from 'vitest'

import { resolveReferralSetupStatus } from '@/lib/affiliate-referral'

describe('affiliate referral setup', () => {
  it('requires setup while any exchange remains unlocked', () => {
    expect(resolveReferralSetupStatus([true, false])).toBe('required')
  })

  it('is configured only when every exchange is locked', () => {
    expect(resolveReferralSetupStatus([true, true])).toBe('configured')
  })

  it('keeps setup required when an exchange cannot be read', () => {
    expect(resolveReferralSetupStatus([true, null])).toBe('required')
  })
})
