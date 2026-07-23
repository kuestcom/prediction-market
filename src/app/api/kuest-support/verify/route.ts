import { verifyKuestSupportAssertion } from '@/lib/kuest-support-assertion'
import resolveSiteUrl from '@/lib/site-url'

const MAX_ASSERTION_LENGTH = 8192

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
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
