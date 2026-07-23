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

export async function POST(request: Request) {
  let body: StatusRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.txHash || !body.fromChainId || !body.toChainId) {
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
