import { connection, NextResponse } from 'next/server'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'

export async function GET() {
  await connection()
  const { data: settings } = await SettingsRepository.getSettings()

  return NextResponse.json(
    {
      enabled: isArbitrageEnabled(settings),
      multiWalletEnabled: isArbitrageMultiWalletEnabled(settings),
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
