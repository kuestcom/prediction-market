import { describe, expect, it } from 'vitest'
import { prettifyJsonResponseBody } from '@/lib/openapi-playground-result'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encodeBody(value: string): ArrayBuffer {
  const bytes = encoder.encode(value)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function decodeBody(body: ArrayBuffer): string {
  return decoder.decode(body)
}

describe('openapi playground result formatting', () => {
  it('expands compact JSON responses', () => {
    const body = prettifyJsonResponseBody(
      'application/json; charset=utf-8',
      encodeBody('{"ok":true,"items":[1,2]}'),
    )

    expect(body).not.toBeNull()
    expect(decodeBody(body!)).toBe(`{
  "ok": true,
  "items": [
    1,
    2
  ]
}`)
  })

  it('supports json suffix media types', () => {
    const body = prettifyJsonResponseBody(
      'application/problem+json',
      encodeBody('{"title":"Invalid request"}'),
    )

    expect(body).not.toBeNull()
    expect(decodeBody(body!)).toBe(`{
  "title": "Invalid request"
}`)
  })

  it('leaves non-json and invalid json bodies unchanged', () => {
    expect(prettifyJsonResponseBody('text/plain', encodeBody('{"ok":true}'))).toBeNull()
    expect(prettifyJsonResponseBody('application/json', encodeBody('not json'))).toBeNull()
  })
})
