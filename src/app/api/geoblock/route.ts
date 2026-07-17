import { NextResponse } from 'next/server'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'
import { loadBlockedCountries } from '@/lib/geoblock-settings'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  await deferPublicShellPrerenderIfNeeded()

  const blockedCountries = await loadBlockedCountries()

  return NextResponse.json(
    { blockedCountries },
    {
      headers: {
        'Cache-Control': MUTABLE_API_CACHE_CONTROL,
      },
    },
  )
}
