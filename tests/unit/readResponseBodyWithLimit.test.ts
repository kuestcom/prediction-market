import { describe, expect, it } from 'vitest'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'

describe('readResponseBodyWithLimit', () => {
  it('returns response bytes when content length is within limit', async () => {
    const response = new Response('hello world', {
      headers: {
        'content-length': '11',
        'content-type': 'text/plain',
      },
    })

    const bytes = await readResponseBodyWithLimit(response, 32)

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(bytes!)).toBe('hello world')
  })

  it('rejects responses that exceed the declared content length limit', async () => {
    const response = new Response('hello world', {
      headers: {
        'content-length': '11',
      },
    })

    const bytes = await readResponseBodyWithLimit(response, 10)

    expect(bytes).toBeNull()
  })

  it('rejects streaming responses that exceed the byte limit without content length', async () => {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'))
        controller.enqueue(new TextEncoder().encode(' world'))
        controller.close()
      },
    }))

    const bytes = await readResponseBodyWithLimit(response, 10)

    expect(bytes).toBeNull()
  })
})
