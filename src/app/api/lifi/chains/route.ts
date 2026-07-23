import { NextResponse } from 'next/server'
import { getLiFiChains } from '@/lib/lifi'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  await deferPublicShellPrerenderIfNeeded()

  try {
    const chains = await getLiFiChains()
    return NextResponse.json({ chains })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI chains.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
