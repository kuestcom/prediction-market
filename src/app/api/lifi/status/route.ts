import { NextResponse } from 'next/server'
import { getLiFiServerActions } from '@/lib/lifi'

interface StatusRequestBody {
  txHash: string
  fromChainId: number
  toChainId: number
  bridge?: string
  fromAddress?: string
  transactionId?: string
}

function isStatusRequestBody(value: unknown): value is StatusRequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const body = value as Record<string, unknown>
  return (
    typeof body.txHash === 'string'
    && body.txHash.trim().length > 0
    && Number.isSafeInteger(body.fromChainId)
    && (body.fromChainId as number) > 0
    && Number.isSafeInteger(body.toChainId)
    && (body.toChainId as number) > 0
    && (body.bridge === undefined || typeof body.bridge === 'string')
    && (body.fromAddress === undefined || typeof body.fromAddress === 'string')
    && (body.transactionId === undefined || typeof body.transactionId === 'string')
  )
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isStatusRequestBody(body)) {
    return NextResponse.json({ error: 'Transfer status parameters are required.' }, { status: 400 })
  }

  const lifi = await getLiFiServerActions()

  try {
    const status = await lifi.getStatus({
      txHash: body.txHash,
      fromChain: body.fromChainId,
      toChain: body.toChainId,
      ...(body.bridge && body.bridge !== 'custom' ? { bridge: body.bridge } : {}),
      ...(body.fromAddress ? { fromAddress: body.fromAddress } : {}),
      ...(body.transactionId ? { transactionId: body.transactionId } : {}),
    })

    return NextResponse.json({
      status: status.status,
      substatus: status.substatus,
      substatusMessage: status.substatusMessage,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI transfer status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
