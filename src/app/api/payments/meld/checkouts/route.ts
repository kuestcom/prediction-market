import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

import { UserRepository } from '@/lib/db/queries/user'
import { isPaymentsLaunchUrl } from '@/lib/payments/launch-url'
import { getPaymentsCanonicalDomain } from '@/lib/payments/operator-key'
import { PaymentsWorkerRequestError, requestPaymentsWorker } from '@/lib/payments/worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    return NextResponse.json({ error: 'invalid_content_type' }, { status: 415 })
  }

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 })
  }

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const walletAddress = user.deposit_wallet_address
  if (user.deposit_wallet_status !== 'deployed' || !walletAddress || !isAddress(walletAddress, { strict: false })) {
    return NextResponse.json({ error: 'deposit_wallet_unavailable' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!isRecord(body) || Object.keys(body).length !== 0) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  let response: Response
  try {
    response = await requestPaymentsWorker('/v1/checkouts', getPaymentsCanonicalDomain(request.headers), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalCustomerId: user.id,
        walletAddress,
      }),
    })
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
    return NextResponse.json({ error: 'checkout_creation_failed' }, { status: 502 })
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    return NextResponse.json({ error: 'invalid_payments_response' }, { status: 502 })
  }

  if (
    !isRecord(result) ||
    typeof result.checkoutId !== 'string' ||
    !/^[0-9a-f-]{36}$/iu.test(result.checkoutId) ||
    !isPaymentsLaunchUrl(result.launchUrl)
  ) {
    return NextResponse.json({ error: 'invalid_payments_response' }, { status: 502 })
  }

  return NextResponse.json(
    { checkoutId: result.checkoutId, launchUrl: result.launchUrl },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}
