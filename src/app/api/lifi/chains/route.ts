import { getChains } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { ensureLiFiServerConfig } from '@/lib/lifi'

export async function GET() {
  await ensureLiFiServerConfig()

  try {
    const chains = await getChains()
    return NextResponse.json({ chains })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI chains.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
