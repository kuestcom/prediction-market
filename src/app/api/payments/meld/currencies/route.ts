import { NextResponse } from 'next/server'

import { UserRepository } from '@/lib/db/queries/user'
import { getPaymentsCanonicalDomain } from '@/lib/payments/operator-key'
import { PaymentsWorkerRequestError, requestPaymentsWorker } from '@/lib/payments/worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(request: Request) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const countryCode = new URL(request.url).searchParams.get('countryCode')
  if (!countryCode || !/^[A-Z]{2}$/u.test(countryCode)) {
    return NextResponse.json({ error: 'invalid_country_code' }, { status: 400 })
  }

  try {
    const response = await requestPaymentsWorker(
      `/v1/onramp/currencies?countryCode=${encodeURIComponent(countryCode)}`,
      getPaymentsCanonicalDomain(request.headers),
    )
    if (!response.ok) {
      return NextResponse.json({ error: 'currency_options_unavailable' }, { status: 502 })
    }
    const result: unknown = await response.json()
    if (!isRecord(result) || !Array.isArray(result.currencies)) {
      return NextResponse.json({ error: 'invalid_currency_options' }, { status: 502 })
    }
    const currencies = result.currencies.filter(
      (currency: unknown): currency is { currencyCode: string; name: string } =>
        isRecord(currency) &&
        typeof currency.currencyCode === 'string' &&
        /^[A-Z]{3}$/u.test(currency.currencyCode) &&
        typeof currency.name === 'string',
    )
    return NextResponse.json({ currencies }, { headers: { 'Cache-Control': 'no-store' } })
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
