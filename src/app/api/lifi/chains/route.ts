import { NextResponse } from 'next/server'
import { getLiFiServerActions } from '@/lib/lifi'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  await deferPublicShellPrerenderIfNeeded()

  const lifi = await getLiFiServerActions()

  try {
    const chains = await lifi.getChains()
    return NextResponse.json({ chains })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI chains.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
