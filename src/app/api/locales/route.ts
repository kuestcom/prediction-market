import { NextResponse } from 'next/server'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  try {
    await deferPublicShellPrerenderIfNeeded()

    const locales = await loadEnabledLocales()
    return NextResponse.json({ locales })
  }
  catch (error) {
    console.error('Failed to load locales', error)
    return NextResponse.json({ locales: [] }, { status: 500 })
  }
}
