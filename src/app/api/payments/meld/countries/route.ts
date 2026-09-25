import { NextResponse } from 'next/server'

import { UserRepository } from '@/lib/db/queries/user'
import { PaymentsWorkerRequestError, requestPaymentsWorker } from '@/lib/payments/worker'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const response = await requestPaymentsWorker('/v1/onramp/countries')
    if (!response.ok) {
      return NextResponse.json({ error: 'country_options_unavailable' }, { status: 502 })
    }
    const result: unknown = await response.json()
    if (!isRecord(result) || !Array.isArray(result.countries)) {
      return NextResponse.json({ error: 'invalid_country_options' }, { status: 502 })
    }
    const countries = result.countries.filter(
      (country): country is { countryCode: string; name: string } =>
        isRecord(country) &&
        typeof country.countryCode === 'string' &&
        /^[A-Z]{2}$/u.test(country.countryCode) &&
        typeof country.name === 'string',
    )
    return NextResponse.json({ countries }, { headers: { 'Cache-Control': 'no-store' } })
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
