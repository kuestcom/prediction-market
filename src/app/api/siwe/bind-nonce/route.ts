import { NextResponse } from 'next/server'
import { bindPendingSiweNonce } from '@/lib/siwe-nonce-bridge'

interface BindNonceRequestBody {
  chainId?: unknown
  nonce?: unknown
  walletAddress?: unknown
}

export async function POST(request: Request) {
  let body: BindNonceRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (
    typeof body.walletAddress !== 'string'
    || typeof body.nonce !== 'string'
    || typeof body.chainId !== 'number'
  ) {
    return NextResponse.json({ error: 'Invalid SIWE nonce binding request.' }, { status: 400 })
  }

  try {
    const result = await bindPendingSiweNonce({
      walletAddress: body.walletAddress,
      chainId: body.chainId,
      nonce: body.nonce,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, walletAddress: result.walletAddress })
  }
  catch (error) {
    console.error('[SIWE] Unable to bind pending nonce', error)
    return NextResponse.json({ error: 'Unable to bind SIWE nonce.' }, { status: 500 })
  }
}
