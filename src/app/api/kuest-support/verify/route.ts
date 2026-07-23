import { verifyKuestSupportAssertion } from '@/lib/kuest-support-assertion'
import resolveSiteUrl from '@/lib/site-url'

const MAX_ASSERTION_LENGTH = 8192
const MAX_REQUEST_BODY_BYTES = 12 * 1024

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return null
  }
  if (!request.body) {
    return null
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    byteLength += value.byteLength
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    body += decoder.decode(value, { stream: true })
  }

  try {
    return JSON.parse(body + decoder.decode()) as unknown
  }
  catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await readBoundedJson(request)
  const assertion = body
    && typeof body === 'object'
    && !Array.isArray(body)
    && typeof (body as Record<string, unknown>).assertion === 'string'
    ? (body as Record<string, unknown>).assertion as string
    : ''

  if (!assertion || assertion.length > MAX_ASSERTION_LENGTH) {
    return Response.json({ error: 'Invalid support assertion.' }, { status: 400 })
  }

  const context = verifyKuestSupportAssertion(assertion)
  if (!context || context.siteUrl !== new URL(resolveSiteUrl(process.env)).origin) {
    return Response.json({ error: 'Invalid or expired support assertion.' }, { status: 401 })
  }

  return Response.json(
    { context },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}
