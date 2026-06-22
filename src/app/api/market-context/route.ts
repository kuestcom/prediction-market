import { MarketContextRequestSchema, resolveMarketContextRequest } from '@/lib/market-context-service'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const parsedPayload = MarketContextRequestSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return Response.json(
      { error: parsedPayload.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  const result = await resolveMarketContextRequest(parsedPayload.data)

  return Response.json(result)
}
