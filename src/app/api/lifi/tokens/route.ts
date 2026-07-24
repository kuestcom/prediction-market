import { NextResponse } from 'next/server'
import { getLiFiTokens } from '@/lib/lifi'

interface TokensRequestBody {
  chains?: number[]
}

const MAX_CHAIN_FILTERS = 32

function isTokensRequestBody(value: unknown): value is TokensRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const { chains } = value as Record<string, unknown>
  return (
    chains === undefined
    || (
      Array.isArray(chains)
      && chains.length <= MAX_CHAIN_FILTERS
      && chains.every(chain => Number.isSafeInteger(chain) && chain > 0)
    )
  )
}

export async function POST(request: Request) {
  let body: unknown = {}
  try {
    body = await request.json()
  }
  catch {
    body = {}
  }

  if (!isTokensRequestBody(body)) {
    return NextResponse.json({ error: 'Invalid chain filters.' }, { status: 400 })
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
