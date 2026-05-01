import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

const CLOB_URL = process.env.CLOB_URL

export async function GET(request: Request) {
  try {
    if (!CLOB_URL) {
      return NextResponse.json({ error: 'CLOB_URL is not configured.' }, { status: 500 })
    }

    const url = new URL(request.url)
    const conditionId = url.searchParams.get('conditionId')?.trim()
    const side = url.searchParams.get('side')?.trim().toUpperCase()
    const makerAmount = url.searchParams.get('makerAmount')?.trim()
    const takerAmount = url.searchParams.get('takerAmount')?.trim()
    const builderCode = url.searchParams.get('builderCode')?.trim()

    if (!conditionId || !side || !makerAmount || !takerAmount) {
      return NextResponse.json(
        { error: 'conditionId, side, makerAmount and takerAmount are required.' },
        { status: 400 },
      )
    }

    if (side !== 'BUY' && side !== 'SELL') {
      return NextResponse.json({ error: 'side must be BUY or SELL.' }, { status: 400 })
    }

    const upstreamParams = new URLSearchParams({
      conditionId,
      side,
      makerAmount,
      takerAmount,
    })

    if (builderCode) {
      upstreamParams.set('builderCode', builderCode)
    }

    const upstream = await fetch(`${CLOB_URL}/fees/final?${upstreamParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })

    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : `Failed to fetch final fee (status ${upstream.status}).`
      return NextResponse.json({ error: message }, { status: upstream.status })
    }

    const feePayload = payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : {}
    const upstreamPlatformPrefix = `${'ku'}${'est'}`

    function readString(key: string, fallback = '0') {
      const value = feePayload[key]
      return typeof value === 'string' ? value : fallback
    }

    return NextResponse.json({
      conditionId: readString('conditionId', conditionId),
      platformMakerFeeAmount: readString('platformMakerFeeAmount', readString(`${upstreamPlatformPrefix}MakerFeeAmount`)),
      platformTakerFeeAmount: readString('platformTakerFeeAmount', readString(`${upstreamPlatformPrefix}TakerFeeAmount`)),
      builderMakerFeeAmount: readString('builderMakerFeeAmount'),
      builderTakerFeeAmount: readString('builderTakerFeeAmount'),
      totalMakerFeeAmount: readString('totalMakerFeeAmount'),
      totalTakerFeeAmount: readString('totalTakerFeeAmount'),
    })
  }
  catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'digest' in error
      && (error as { digest?: string }).digest === 'NEXT_PRERENDER_INTERRUPTED'
    ) {
      throw error
    }

    console.error('Failed to fetch final fee preview.', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
