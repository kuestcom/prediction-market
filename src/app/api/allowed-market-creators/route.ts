import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'

export async function GET() {
  try {
    const { data, error } = await AllowedMarketCreatorRepository.listWallets()
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
