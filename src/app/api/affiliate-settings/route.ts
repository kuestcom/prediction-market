import { NextResponse } from 'next/server'
import { bpsToPercent, getAffiliateFeeSettings, getAffiliateFeeSettingsUpdatedAt } from '@/lib/affiliate-fee-settings'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'

interface AffiliateSettingsResponse {
  builderTakerFeePercent: number
  builderMakerFeePercent: number
  affiliateSharePercent: number
  lastUpdated?: string
}

export async function GET() {
  try {
    const { data: settings, error } = await SettingsRepository.getSettings()

    if (error || !settings) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const affiliateFeeSettings = getAffiliateFeeSettings(settings)
    const builderTakerFeePercent = bpsToPercent(affiliateFeeSettings.builderTakerFeeBps)
    const builderMakerFeePercent = bpsToPercent(affiliateFeeSettings.builderMakerFeeBps)
    const affiliateSharePercent = bpsToPercent(affiliateFeeSettings.affiliateShareBps)

    if (
      Number.isNaN(builderTakerFeePercent)
      || Number.isNaN(builderMakerFeePercent)
      || Number.isNaN(affiliateSharePercent)
    ) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const latestUpdatedAt = getAffiliateFeeSettingsUpdatedAt(settings)

    const response: AffiliateSettingsResponse = {
      builderTakerFeePercent,
      builderMakerFeePercent,
      affiliateSharePercent,
      lastUpdated: latestUpdatedAt,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
