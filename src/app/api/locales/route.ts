import { unstable_rethrow } from 'next/navigation'
import { NextResponse } from 'next/server'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  try {
    await deferPublicShellPrerenderIfNeeded()

    const locales = await loadEnabledLocales()
    return NextResponse.json(
      { locales },
      { headers: { 'Cache-Control': MUTABLE_API_CACHE_CONTROL } },
    )
  }
  catch (error) {
    unstable_rethrow(error)
    console.error('Failed to load locales', error)
    return NextResponse.json({ locales: [] }, { status: 500 })
  }
}
