import { NextResponse } from 'next/server'
import { loadBlockedCountries } from '@/lib/geoblock-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const blockedCountries = await loadBlockedCountries()

  return NextResponse.json(
    { blockedCountries },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
