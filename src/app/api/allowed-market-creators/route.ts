import { NextResponse } from 'next/server'
import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

export async function GET() {
  try {
    const { data, error } = await loadAllowedMarketCreatorWallets()
    if (error || !data) {
      return NextResponse.json({ error: error ?? DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({ wallets: data })
  }
  catch (error) {
    console.error('Failed to load allowed market creators:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
