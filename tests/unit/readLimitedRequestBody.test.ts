import { describe, expect, it, vi } from 'vitest'

import { readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/read-limited-request-body'

describe('readLimitedRequestBody', () => {
  it('cancels a chunked body as soon as it exceeds the byte limit', async () => {
    const cancel = vi.fn()
    const chunks = [new Uint8Array(3), new Uint8Array(3), new Uint8Array(3)]
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift()
        if (next) {
          controller.enqueue(next)
        } else {
          controller.close()
        }
      },
      cancel,
    })

    await expect(readLimitedRequestBody(body, 5)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('decodes a body whose byte size exactly matches the limit', async () => {
    const encoded = new TextEncoder().encode('ação')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded)
        controller.close()
      },
    })

    await expect(readLimitedRequestBody(body, encoded.byteLength)).resolves.toBe('ação')
  })
})
