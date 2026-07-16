import { NextResponse } from 'next/server'

const TOKEN_ID_PATTERN = /^\d{1,100}$/
const POLYMARKET_REQUEST_TIMEOUT_MS = 8_000

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { tokenIds?: unknown } | null
  const rawTokenIds = payload?.tokenIds
  const tokenIds = Array.isArray(rawTokenIds)
    ? rawTokenIds.filter((value): value is string => typeof value === 'string' && TOKEN_ID_PATTERN.test(value))
    : []

  if (tokenIds.length === 0 || tokenIds.length > 4 || !Array.isArray(rawTokenIds) || tokenIds.length !== rawTokenIds.length) {
    return NextResponse.json({ error: 'Invalid token IDs.' }, { status: 400 })
  }

  try {
    const response = await fetch('https://clob.polymarket.com/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(tokenIds.map(tokenId => ({ token_id: tokenId }))),
      cache: 'no-store',
      signal: AbortSignal.timeout(POLYMARKET_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'Polymarket order book unavailable.' }, { status: 502 })
    }

    const books = await response.json() as Array<{ asset_id?: string, bids?: unknown[], asks?: unknown[] }>
    if (!Array.isArray(books)) {
      return NextResponse.json({ error: 'Polymarket order book unavailable.' }, { status: 502 })
    }
    const summaries = Object.fromEntries(tokenIds.map((tokenId) => {
      const book = books.find(entry => entry?.asset_id === tokenId)
      return [tokenId, { bids: book?.bids ?? [], asks: book?.asks ?? [] }]
    }))

    return NextResponse.json(summaries)
  }
  catch {
    return NextResponse.json({ error: 'Polymarket order book unavailable.' }, { status: 502 })
  }
}
