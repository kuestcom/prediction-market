import { io } from 'next/cache'
import { NextResponse } from 'next/server'

import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'

export async function GET() {
  await io()
  const { data: settings } = await SettingsRepository.getSettings()

  return NextResponse.json(
    {
      enabled: isArbitrageEnabled(settings),
      multiWalletEnabled: isArbitrageMultiWalletEnabled(settings),
    },
    { headers: { 'Cache-Control': MUTABLE_API_CACHE_CONTROL } },
  )
}
