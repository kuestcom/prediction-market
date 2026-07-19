import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sumsubMocks = vi.hoisted(() => ({
  requireApproval: vi.fn(),
}))

vi.mock('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: sumsubMocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))

const mocks = vi.hoisted(() => ({
  buildClobHmacSignature: vi.fn(() => 'l2-signature'),
  dbLimit: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserTradingAuthSecrets: vi.fn(),
}))

vi.mock('@/lib/hmac', () => ({
  buildClobHmacSignature: mocks.buildClobHmacSignature,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (...args: any[]) => mocks.dbLimit(...args),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: (...args: any[]) => mocks.getUserTradingAuthSecrets(...args),
}))

const userAddress = '0x0000000000000000000000000000000000000001'
const sessionAddress = '0x0000000000000000000000000000000000000002'
const signedNonce = '7'
const signedPayload = {
  address: userAddress,
  signature: '0xsignature',
  timestamp: '1710000000',
  nonce: signedNonce,
}

function makeCredential(service: 'clob' | 'relayer') {
  return {
    key: `${service}-key`,
    secret: `${service}-secret`,
    passphrase: `${service}-passphrase`,
  }
}

function makeCredentialPayload(service: 'clob' | 'relayer') {
  const credential = makeCredential(service)
  return {
    apiKey: credential.key,
    secret: credential.secret,
    passphrase: credential.passphrase,
  }
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sdk api key actions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    mocks.buildClobHmacSignature.mockClear()
    mocks.dbLimit.mockReset()
    mocks.dbLimit.mockResolvedValue([])
    mocks.getCurrentUser.mockReset()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', address: userAddress })
    mocks.getUserTradingAuthSecrets.mockReset()
    mocks.getUserTradingAuthSecrets.mockResolvedValue({
      clob: makeCredential('clob'),
      relayer: makeCredential('relayer'),
    })
    sumsubMocks.requireApproval.mockReset().mockResolvedValue({ allowed: true })
    process.env.CLOB_URL = 'https://clob.local'
    process.env.RELAYER_URL = 'https://relayer.local'
  })

  it('blocks SDK credential generation before contacting either service', async () => {
    sumsubMocks.requireApproval.mockResolvedValue({ allowed: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { generateSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(generateSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      data: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('generates SDK credentials for CLOB and relayer with wallet auth headers only', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('clob')))
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('relayer')))
    vi.stubGlobal('fetch', fetchMock)

    const { generateSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(generateSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: null,
      warning: null,
      data: {
        nonce: signedNonce,
        address: userAddress,
        clob: makeCredential('clob'),
        relayer: makeCredential('relayer'),
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://clob.local/auth/api-key', expect.objectContaining({
      method: 'POST',
      body: '',
      cache: 'no-store',
      headers: expect.objectContaining({
        KUEST_ADDRESS: userAddress,
        KUEST_SIGNATURE: signedPayload.signature,
        KUEST_TIMESTAMP: signedPayload.timestamp,
        KUEST_NONCE: signedNonce,
      }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://relayer.local/auth/api-key', expect.objectContaining({
      method: 'POST',
      body: '',
      cache: 'no-store',
    }))
    expect(mocks.dbLimit).not.toHaveBeenCalled()
  })

  it('uses the signed linked wallet address instead of a divergent session address', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'user-1', address: sessionAddress })
    mocks.dbLimit.mockResolvedValueOnce([{ id: 'wallet-1' }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('clob')))
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('relayer')))
    vi.stubGlobal('fetch', fetchMock)

    const { generateSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(generateSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: null,
      warning: null,
      data: {
        nonce: signedNonce,
        address: userAddress,
        clob: makeCredential('clob'),
        relayer: makeCredential('relayer'),
      },
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://clob.local/auth/api-key', expect.objectContaining({
      headers: expect.objectContaining({
        KUEST_ADDRESS: userAddress,
      }),
    }))
    expect(mocks.dbLimit).toHaveBeenCalledOnce()
  })

  it('reveals SDK credentials by deriving the signed nonce without request body secrets', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('clob')))
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('relayer')))
    vi.stubGlobal('fetch', fetchMock)

    const { revealSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(revealSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: null,
      warning: null,
      data: {
        nonce: signedNonce,
        address: userAddress,
        clob: makeCredential('clob'),
        relayer: makeCredential('relayer'),
      },
    })

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit
      expect(init.method).toBe('GET')
      expect(init.body).toBeUndefined()
      expect(init.headers).toEqual(expect.objectContaining({ KUEST_NONCE: signedNonce }))
    }
  })

  it('returns available credentials with a warning when one auth service fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(makeCredentialPayload('clob')))
      .mockResolvedValueOnce(jsonResponse({ error: 'temporarily unavailable' }, 503))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetchMock)

    const { generateSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(generateSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: null,
      warning: 'Completed for the available service only. Failed service: RELAYER.',
      data: {
        nonce: signedNonce,
        address: userAddress,
        clob: makeCredential('clob'),
      },
    })
  })

  it('revokes the signed nonce SDK key by deriving credentials and sending authenticated DELETEs', async () => {
    sumsubMocks.requireApproval.mockResolvedValue({ allowed: false })
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'GET') {
        return jsonResponse(url.includes('clob') ? makeCredentialPayload('clob') : makeCredentialPayload('relayer'))
      }

      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const { revokeSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(revokeSdkApiKeyAction(signedPayload)).resolves.toEqual({
      error: null,
      warning: null,
      data: {
        nonce: signedNonce,
        revoked: {
          clob: true,
          relayer: true,
        },
      },
    })

    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit).method === 'DELETE')
    expect(deleteCalls).toHaveLength(2)
    expect(deleteCalls[0]?.[1]).toEqual(expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({
        KUEST_ADDRESS: userAddress,
        KUEST_API_KEY: 'clob-key',
        KUEST_PASSPHRASE: 'clob-passphrase',
        KUEST_SIGNATURE: 'l2-signature',
      }),
    }))
    expect(deleteCalls[1]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        KUEST_API_KEY: 'relayer-key',
        KUEST_PASSPHRASE: 'relayer-passphrase',
      }),
    }))
    expect(mocks.buildClobHmacSignature).toHaveBeenCalledWith('clob-secret', expect.any(Number), 'DELETE', '/auth/api-key')
    expect(mocks.buildClobHmacSignature).toHaveBeenCalledWith('relayer-secret', expect.any(Number), 'DELETE', '/auth/api-key')
    expect(sumsubMocks.requireApproval).not.toHaveBeenCalled()
  })

  it('resolves the next SDK key nonce from metadata across all services', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { apiKey: 'clob-key-1', nonce: '100', status: 'active' },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { apiKey: 'relayer-key-1', nonce: '102', status: 'active' },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const { getNextSdkApiKeyNonceAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(getNextSdkApiKeyNonceAction({ address: userAddress })).resolves.toEqual({
      error: null,
      nonce: '103',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://clob.local/auth/api-keys?metadata=true&includeRevoked=true',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://relayer.local/auth/api-keys?metadata=true&includeRevoked=true',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    )
    expect(mocks.buildClobHmacSignature).toHaveBeenCalledWith(
      'clob-secret',
      expect.any(Number),
      'GET',
      '/auth/api-keys',
    )
    expect(mocks.buildClobHmacSignature).toHaveBeenCalledWith(
      'relayer-secret',
      expect.any(Number),
      'GET',
      '/auth/api-keys',
    )
  })

  it('fails nonce resolution when one metadata service is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { apiKey: 'clob-key-1', nonce: '100', status: 'active' },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'temporarily unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const { getNextSdkApiKeyNonceAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(getNextSdkApiKeyNonceAction({ address: userAddress })).resolves.toEqual({
      error: 'Internal server error. Try again in a few moments.',
      nonce: null,
    })

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to resolve next SDK API key nonce.',
      expect.any(Error),
    )
  })

  it('returns nonce zero when no internal API credentials are stored yet', async () => {
    const fetchMock = vi.fn()
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce(null)
    vi.stubGlobal('fetch', fetchMock)

    const { getNextSdkApiKeyNonceAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(getNextSdkApiKeyNonceAction({ address: userAddress })).resolves.toEqual({
      error: null,
      nonce: '0',
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails nonce resolution when a configured service has no stored internal credential', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
    mocks.getUserTradingAuthSecrets.mockResolvedValueOnce({
      clob: makeCredential('clob'),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { getNextSdkApiKeyNonceAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')

    await expect(getNextSdkApiKeyNonceAction({ address: userAddress })).resolves.toEqual({
      error: 'Internal server error. Try again in a few moments.',
      nonce: null,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to resolve next SDK API key nonce.',
      expect.any(Error),
    )
  })

  it('does not expose backend error payload secrets in logs or returned errors', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: 'backend included leaked_secret and leaked_passphrase',
    }, 500))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetchMock)

    const { generateSdkApiKeyAction } = await import('@/app/[locale]/(platform)/settings/_actions/sdk-api-keys')
    const result = await generateSdkApiKeyAction(signedPayload)

    expect(result.error).toBeTruthy()
    expect(JSON.stringify(result)).not.toContain('leaked_secret')
    expect(JSON.stringify(result)).not.toContain('leaked_passphrase')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('leaked_secret')
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('leaked_passphrase')
  })
})
