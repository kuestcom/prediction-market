import { NextResponse } from 'next/server'

const CONDITION_ID_PATTERN = /^0x[a-fA-F0-9]{64}$/

export async function GET(request: Request) {
  const conditionId = new URL(request.url).searchParams.get('conditionId')?.trim() ?? ''
  if (!CONDITION_ID_PATTERN.test(conditionId)) {
    return NextResponse.json({ error: 'Invalid condition ID.' }, { status: 400 })
  }

  const response = await fetch(`https://clob.polymarket.com/clob-markets/${conditionId}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 30 },
  })
  if (!response.ok) {
    return NextResponse.json({ error: 'Polymarket market info unavailable.' }, { status: 502 })
  }

  const data = await response.json() as { fd?: { e?: unknown, r?: unknown }, mos?: unknown }
  const feeRate = Number(data.fd?.r)
  const feeExponent = Number(data.fd?.e)
  const minimumOrderSize = Number(data.mos)

  return NextResponse.json({
    feeRate: Number.isFinite(feeRate) && feeRate > 0 ? feeRate : 0,
    feeExponent: Number.isFinite(feeExponent) && feeExponent >= 0 ? feeExponent : 0,
    minimumOrderSize: Number.isFinite(minimumOrderSize) && minimumOrderSize > 0 ? minimumOrderSize : 0,
  })
}
