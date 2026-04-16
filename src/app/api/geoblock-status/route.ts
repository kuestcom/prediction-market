import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  getRequestCountryCode,
  isCountryBlocked,
  loadBlockedCountries,
} from '@/lib/geoblock-settings'

export async function GET(request: NextRequest) {
  const blockedCountries = await loadBlockedCountries()
  const country = getRequestCountryCode(request.headers)

  return NextResponse.json(
    {
      blocked: isCountryBlocked(country, blockedCountries),
      country,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
