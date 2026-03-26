export async function readResponseBodyWithLimit(response: Response, maxBytes: number) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('maxBytes must be a positive number.')
  }

  const contentLengthHeader = response.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : Number.NaN

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return null
  }

  if (!response.body) {
    return null
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  let exceededLimit = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      if (!value || value.byteLength === 0) {
        continue
      }

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        exceededLimit = true
        await reader.cancel('Response body exceeds byte limit.')
        break
      }

      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }

  if (exceededLimit) {
    return null
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return merged
}
