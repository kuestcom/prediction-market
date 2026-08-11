import { describe, expect, it } from 'vitest'

import { resolveReferralExchangeReads, resolveReferralSetupStatus } from '@/lib/affiliate-referral'

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

  it('keeps normal approvals available while retrying unknown referral exchanges', () => {
    expect(resolveReferralExchangeReads(['standard', 'neg-risk'], [false, null])).toEqual({
      exchangesToConfigure: ['standard'],
      fullyChecked: false,
    })
  })

  it('confirms referral reads only after every exchange responds', () => {
    expect(resolveReferralExchangeReads(['standard', 'neg-risk'], [true, false])).toEqual({
      exchangesToConfigure: ['neg-risk'],
      fullyChecked: true,
    })
  })
})
