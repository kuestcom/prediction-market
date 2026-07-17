import { NextResponse } from 'next/server'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

export async function GET() {
  await deferPublicShellPrerenderIfNeeded()
  const { data: settings } = await SettingsRepository.getSettings()

  return NextResponse.json(
    {
      enabled: isArbitrageEnabled(settings),
      multiWalletEnabled: isArbitrageMultiWalletEnabled(settings),
    },
    { headers: { 'Cache-Control': MUTABLE_API_CACHE_CONTROL } },
  )
}
