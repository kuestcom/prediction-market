import type { LiFiStep } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { UserRepository } from '@/lib/db/queries/user'
import { assertIdentityAccess } from '@/lib/identity/access'
import { getLiFiServerActions } from '@/lib/lifi'

interface StepTransactionRequestBody {
  step: LiFiStep
}

export async function POST(request: Request) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }
  try {
    await assertIdentityAccess(user.id, 'deposit')
  }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'IDENTITY_REQUIRED' }, { status: 403 })
  }
  const lifi = await getLiFiServerActions()

  let body: StepTransactionRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.step) {
    return NextResponse.json({ error: 'step is required.' }, { status: 400 })
  }

  try {
    const step = await lifi.getStepTransaction(body.step)
    return NextResponse.json({ step })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI step transaction.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
