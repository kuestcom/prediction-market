import { afterEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getSettings: mock(),
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: { getSettings: mocks.getSettings },
}))

void mock.module('@/lib/encryption', () => ({
  decryptSecret: (value: string) => (value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : ''),
}))

const challengeIdA = 'A'.repeat(22)
const challengeIdB = 'B'.repeat(22)
const challengeA = 'C'.repeat(43)
const challengeB = 'D'.repeat(43)
const registrationToken = 'R'.repeat(43)

function storedChallenge(challengeId: string, challenge: string) {
  return `encrypted:${JSON.stringify({
    domain: 'fork.example',
    challengeId,
    challenge,
    registrationToken,
    expiresAt: Date.now() + 60_000,
  })}`
}

describe('payments domain challenge route', () => {
  afterEach(() => mock.clearAllMocks())

  it('serves only the unexpired challenge stored for the requested ID and host', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        payments: {
          [`operator_domain_challenge:${challengeIdA}`]: { value: storedChallenge(challengeIdA, challengeA) },
          [`operator_domain_challenge:${challengeIdB}`]: { value: storedChallenge(challengeIdB, challengeB) },
        },
      },
      error: null,
    })
    const { GET } = await import('@/app/api/payments/domain-challenge/route')

    const response = await GET(new Request(`https://fork.example/api/payments/domain-challenge?id=${challengeIdB}`))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(body).toBe(challengeB)
    expect(body).not.toContain(registrationToken)
  })

  it('does not echo query values or serve a challenge for a different host or ID', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        payments: {
          [`operator_domain_challenge:${challengeIdA}`]: { value: storedChallenge(challengeIdA, challengeA) },
        },
      },
      error: null,
    })
    const { GET } = await import('@/app/api/payments/domain-challenge/route')

    const injectedResponse = await GET(
      new Request(`https://fork.example/api/payments/domain-challenge?id=${challengeIdA}&challenge=attacker`),
    )
    const duplicateIdResponse = await GET(
      new Request(`https://fork.example/api/payments/domain-challenge?id=${challengeIdA}&id=${challengeIdA}`),
    )
    const wrongIdResponse = await GET(
      new Request(`https://fork.example/api/payments/domain-challenge?id=${challengeIdB}`),
    )
    const wrongHostResponse = await GET(
      new Request(`https://alias.example/api/payments/domain-challenge?id=${challengeIdA}`),
    )
    const missingIdResponse = await GET(new Request('https://fork.example/api/payments/domain-challenge'))

    for (const response of [
      injectedResponse,
      duplicateIdResponse,
      wrongIdResponse,
      wrongHostResponse,
      missingIdResponse,
    ]) {
      expect(response.status).toBe(404)
    }
  })
})
