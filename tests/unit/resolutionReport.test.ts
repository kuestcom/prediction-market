import { recoverMessageAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  buildResolutionReportMessage,
  isResolutionReportCorrect,
  isResolutionReportOutcome,
} from '@/lib/resolution-report'

const PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('resolution report signatures', () => {
  it('binds the EOA signature to the market and proposed outcome', async () => {
    const account = privateKeyToAccount(PRIVATE_KEY)
    const input = {
      conditionId: '0xcondition',
      eventId: '01TESTEVENT0000000000000000',
      issuedAt: '2026-08-01T20:00:00.000Z',
      nonce: '123e4567-e89b-42d3-a456-426614174000',
      outcome: 'yes' as const,
      reporterAddress: account.address,
    }
    const message = buildResolutionReportMessage(input)
    const signature = await account.signMessage({ message })

    expect(message).not.toContain('Version:')
    await expect(recoverMessageAddress({ message, signature })).resolves.toBe(account.address)

    const changedOutcomeMessage = buildResolutionReportMessage({ ...input, outcome: 'no' })
    await expect(recoverMessageAddress({ message: changedOutcomeMessage, signature })).resolves.not.toBe(
      account.address,
    )
  })

  it('accepts only supported structured outcomes', () => {
    expect(['yes', 'no', 'unknown'].every(isResolutionReportOutcome)).toBe(true)
    expect(isResolutionReportOutcome('Yes')).toBe(false)
    expect(isResolutionReportOutcome('https://example.com')).toBe(false)
    expect(isResolutionReportOutcome({ outcome: 'yes' })).toBe(false)
  })

  it('scores resolved proposals from the final binary payouts', () => {
    expect(isResolutionReportCorrect('yes', 1, 0)).toBe(true)
    expect(isResolutionReportCorrect('no', 1, 0)).toBe(false)
    expect(isResolutionReportCorrect('unknown', 0.5, 0.5)).toBe(true)
    expect(isResolutionReportCorrect('yes', 0.5, 0.5)).toBe(false)
    expect(isResolutionReportCorrect('yes', null, null)).toBeNull()
  })
})
