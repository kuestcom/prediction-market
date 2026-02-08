import { getWalletBalances } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { ensureLiFiServerConfig } from '@/lib/lifi'

interface BalancesRequestBody {
  walletAddress: string
}

export async function POST(request: Request) {
  await ensureLiFiServerConfig()

  let body: BalancesRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required.' }, { status: 400 })
  }

  try {
    const balances = await getWalletBalances(body.walletAddress)
    return NextResponse.json({ balances })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI balances.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
