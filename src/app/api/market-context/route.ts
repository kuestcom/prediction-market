import { UserRepository } from '@/lib/db/queries/user'
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

  if (!parsedPayload.data.readOnly) {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser) {
      return Response.json(
        { error: 'Authentication required to generate market context.' },
        { status: 401 },
      )
    }
  }

  const result = await resolveMarketContextRequest(parsedPayload.data)

  return Response.json(result)
}
