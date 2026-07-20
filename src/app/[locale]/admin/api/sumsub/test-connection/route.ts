import { NextResponse } from 'next/server'
import { SumsubRepository } from '@/lib/db/queries/sumsub'
import { UserRepository } from '@/lib/db/queries/user'
import { SumsubClient, SumsubClientError } from '@/lib/sumsub/client'
import { getSumsubSettings, SUMSUB_LIMITS } from '@/lib/sumsub/settings'

export async function POST(request: Request) {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user?.is_admin) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  let input: Record<string, unknown>
  try {
    const parsed = await request.json() as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    input = parsed as Record<string, unknown>
  }
  catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    if (!await SumsubRepository.consumeTestConnectionRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many connection tests.' }, { status: 429 })
    }
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
    const status = error instanceof SumsubClientError ? error.status : 503
    return NextResponse.json({ error: error instanceof SumsubClientError ? error.message : 'Unable to test Sumsub.' }, { status })
  }
}
