import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

import { UserRepository } from '@/lib/db/queries/user'
import { getPaymentsCanonicalDomain } from '@/lib/payments/operator-key'
import { PaymentsWorkerRequestError, requestPaymentsWorker } from '@/lib/payments/worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuote(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.quoteId === 'string' &&
    /^[0-9a-f-]{36}$/iu.test(value.quoteId) &&
    typeof value.serviceProvider === 'string' &&
    typeof value.paymentMethodType === 'string' &&
    typeof value.sourceAmount === 'number' &&
    Number.isFinite(value.sourceAmount) &&
    typeof value.sourceCurrencyCode === 'string' &&
    typeof value.destinationAmount === 'number' &&
    Number.isFinite(value.destinationAmount) &&
    value.destinationCurrencyCode === 'USDC_POLYGON'
  )
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
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const countryCode = body.countryCode
  const sourceCurrencyCode = body.sourceCurrencyCode
  const sourceAmount = body.sourceAmount
  if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/u.test(countryCode)) {
    return NextResponse.json({ error: 'invalid_country_code' }, { status: 400 })
  }
  if (typeof sourceCurrencyCode !== 'string' || !/^[A-Z]{3}$/u.test(sourceCurrencyCode)) {
    return NextResponse.json({ error: 'invalid_fiat_currency' }, { status: 400 })
  }
  if (typeof sourceAmount !== 'number' || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return NextResponse.json({ error: 'invalid_source_amount' }, { status: 400 })
  }

  try {
    const response = await requestPaymentsWorker('/v1/quotes', getPaymentsCanonicalDomain(request.headers), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode,
        sourceCurrencyCode,
        sourceAmount,
        externalCustomerId: user.id,
        walletAddress,
      }),
    })
    if (!response.ok) {
      return NextResponse.json(
        { error: response.status === 422 ? 'no_compatible_quotes' : 'quotes_unavailable' },
        { status: response.status === 422 ? 422 : 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const result: unknown = await response.json()
    if (!isRecord(result) || !Array.isArray(result.quotes)) {
      return NextResponse.json({ error: 'invalid_quotes_response' }, { status: 502 })
    }
    const quotes = result.quotes.filter(isQuote)
    if (quotes.length === 0) {
      return NextResponse.json({ error: 'no_compatible_quotes' }, { status: 422 })
    }
    return NextResponse.json({ quotes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PaymentsWorkerRequestError) {
      return NextResponse.json(
        { error: error.code === 'not_configured' ? 'payments_not_configured' : 'payments_unavailable' },
        { status: error.code === 'not_configured' ? 503 : 502 },
      )
    }
    return NextResponse.json({ error: 'payments_unavailable' }, { status: 502 })
  }
}
