import { NextResponse } from 'next/server'
import { createPendingSiweNonce } from '@/lib/siwe-nonce-bridge'

export async function POST() {
  try {
    const nonce = await createPendingSiweNonce()
    return NextResponse.json({ nonce })
  }
  catch (error) {
    console.error('[SIWE] Unable to create pending nonce', error)
    return NextResponse.json({ error: 'Unable to create SIWE nonce.' }, { status: 500 })
  }
}
