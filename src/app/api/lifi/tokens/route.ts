import { NextResponse } from 'next/server'
import { getLiFiTokens } from '@/lib/lifi'

interface TokensRequestBody {
  chains?: number[]
}

export async function POST(request: Request) {
  let body: TokensRequestBody = {}
  try {
    body = await request.json()
  }
  catch {
    body = {}
  }

  try {
    const tokens = await getLiFiTokens(body.chains)

    return NextResponse.json({ tokens })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI tokens.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
