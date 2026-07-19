import { NextResponse } from 'next/server'
import { UserRepository } from '@/lib/db/queries/user'
import { SumsubClient, SumsubClientError } from '@/lib/sumsub/client'
import { getSumsubSettings, SUMSUB_LIMITS } from '@/lib/sumsub/settings'

const attempts = new Map<string, { count: number, startedAt: number }>()

export async function POST(request: Request) {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user?.is_admin) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const now = Date.now()
  const attempt = attempts.get(user.id)
  if (attempt && now - attempt.startedAt < 60_000 && attempt.count >= 5) {
    return NextResponse.json({ error: 'Too many connection tests.' }, { status: 429 })
  }
  attempts.set(user.id, !attempt || now - attempt.startedAt >= 60_000
    ? { count: 1, startedAt: now }
    : { count: attempt.count + 1, startedAt: attempt.startedAt })

  try {
    const input = await request.json() as Record<string, unknown>
    const stored = await getSumsubSettings()
    const appToken = typeof input.appToken === 'string' && input.appToken.trim() ? input.appToken.trim() : stored.appToken
    const secretKey = typeof input.secretKey === 'string' && input.secretKey.trim() ? input.secretKey.trim() : stored.secretKey
    const levelName = typeof input.levelName === 'string' ? input.levelName.trim() : ''
    if (!appToken || !secretKey || !levelName
      || appToken.length > SUMSUB_LIMITS.appToken
      || secretKey.length > SUMSUB_LIMITS.secretKey
      || levelName.length > SUMSUB_LIMITS.levelName) {
      return NextResponse.json({ error: 'Complete the Sumsub credentials and level name.' }, { status: 400 })
    }
    await new SumsubClient({ appToken, secretKey }).testConnection(levelName)
    return NextResponse.json({ ok: true, webhookNote: 'Webhook Secret is validated only when a real webhook is received.' })
  }
  catch (error) {
    const status = error instanceof SumsubClientError ? error.status : 400
    return NextResponse.json({ error: error instanceof SumsubClientError ? error.message : 'Unable to test Sumsub.' }, { status })
  }
}
