import { NextResponse } from 'next/server'

import { UserRepository } from '@/lib/db/queries/user'
import { getPaymentsCanonicalDomain } from '@/lib/payments/operator-key'
import { PaymentsWorkerRequestError, requestPaymentsCheckoutStatus } from '@/lib/payments/worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(request: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { checkoutId } = await params
  if (!/^[0-9a-f-]{36}$/iu.test(checkoutId)) {
    return NextResponse.json({ error: 'invalid_checkout_id' }, { status: 400 })
  }

  let response: Response
  try {
    response = await requestPaymentsCheckoutStatus(checkoutId, user.id, getPaymentsCanonicalDomain(request.headers))
  } catch (error) {
    if (error instanceof PaymentsWorkerRequestError) {
      return NextResponse.json(
        { error: error.code === 'not_configured' ? 'payments_not_configured' : 'payments_unavailable' },
        { status: error.code === 'not_configured' ? 503 : 502 },
      )
    }
    return NextResponse.json({ error: 'payments_unavailable' }, { status: 502 })
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: response.status === 404 ? 'checkout_not_found' : 'status_unavailable' },
      { status: response.status === 404 ? 404 : 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    return NextResponse.json({ error: 'invalid_payments_response' }, { status: 502 })
  }

  if (!isRecord(result) || typeof result.status !== 'string' || !/^[A-Z_ ]{1,64}$/u.test(result.status)) {
    return NextResponse.json({ error: 'invalid_payments_response' }, { status: 502 })
  }

  return NextResponse.json(
    {
      checkoutId,
      status: result.status,
      updatedAt: typeof result.updatedAt === 'string' ? result.updatedAt : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
