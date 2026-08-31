import { io } from 'next/cache'
import { NextResponse } from 'next/server'

import { getLiFiServerActions } from '@/lib/lifi'

export async function GET() {
  await io()

  const lifi = await getLiFiServerActions()

  try {
    const chains = await lifi.getChains()
    return NextResponse.json({ chains })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI chains.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
