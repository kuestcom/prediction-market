import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDENTITY_MAX_PROVIDER_PAYLOAD_BYTES } from '@/lib/identity/constants'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  processWebhook: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('@/lib/db/queries/identity-document', () => ({
  IdentityDocumentRepository: { upload: mocks.upload },
}))

vi.mock('@/lib/db/queries/identity-provider', () => ({
  IdentityProviderRepository: { processWebhook: mocks.processWebhook },
}))

describe('identity request body boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('rejects multipart uploads without Content-Length before parsing form data', async () => {
    const formData = vi.fn()
    const request = {
      headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }),
      formData,
    }
    const { POST } = await import('@/app/api/identity/documents/route')

    const response = await POST(request as never)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: 'IDENTITY_DOCUMENT_SIZE_INVALID' })
    expect(formData).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('stops an oversized webhook stream even when Content-Length is absent', async () => {
    const chunk = new Uint8Array(IDENTITY_MAX_PROVIDER_PAYLOAD_BYTES + 1)
    const request = new Request('https://example.test/api/identity/providers/generic/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(chunk)
          controller.close()
        },
      }),
      duplex: 'half',
    } as RequestInit)
    const { POST } = await import('@/app/api/identity/providers/[provider]/webhook/route')

    const response = await POST(request as never, { params: Promise.resolve({ provider: 'generic' }) })

    expect(response.status).toBe(413)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })
})
