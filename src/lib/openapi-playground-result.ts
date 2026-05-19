function isJsonContentType(contentType: string | null): boolean {
  const mimeType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
  return mimeType === 'application/json' || Boolean(mimeType?.endsWith('+json'))
}

export function prettifyJsonResponseBody(
  contentType: string | null,
  body: ArrayBuffer,
): ArrayBuffer | null {
  if (!isJsonContentType(contentType) || body.byteLength === 0) {
    return null
  }

  const decoder = new TextDecoder('utf-8')
  const bodyText = decoder.decode(body)

  try {
    const formattedBody = JSON.stringify(JSON.parse(bodyText), null, 2)
    const bytes = new TextEncoder().encode(formattedBody)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  catch {
    return null
  }
}
