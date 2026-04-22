import { resolveMarketContextRequest } from '@/lib/market-context-service'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const localeHeader = request.headers.get('x-kuest-locale')
  const result = await resolveMarketContextRequest(payload, localeHeader)

  if (result.error && payload == null) {
    return Response.json(result, { status: 400 })
  }

  return Response.json(result)
}
