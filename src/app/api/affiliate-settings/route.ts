import { unstable_rethrow } from 'next/navigation'
import { NextResponse } from 'next/server'

import { bpsToPercent, getAffiliateFeeSettings, getAffiliateFeeSettingsUpdatedAt } from '@/lib/affiliate-fee-settings'
import { MUTABLE_API_CACHE_CONTROL } from '@/lib/api-cache'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'

interface AffiliateSettingsResponse {
  builderTakerSharePercent: number
  builderMakerFlatFeePercent: number
  affiliateSharePercent: number
  lastUpdated?: string
}

export async function GET() {
  try {
    await deferPublicShellPrerenderIfNeeded()

    const { data: settings, error } = await SettingsRepository.getSettings()

    if (error || !settings) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const affiliateFeeSettings = getAffiliateFeeSettings(settings)
    const builderTakerSharePercent = bpsToPercent(affiliateFeeSettings.builderTakerFeeShareBps)
    const builderMakerFlatFeePercent = bpsToPercent(affiliateFeeSettings.builderMakerFlatFeeBps)
    const affiliateSharePercent = bpsToPercent(affiliateFeeSettings.affiliateShareBps)

    if (
      Number.isNaN(builderTakerSharePercent) ||
      Number.isNaN(builderMakerFlatFeePercent) ||
      Number.isNaN(affiliateSharePercent)
    ) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const latestUpdatedAt = getAffiliateFeeSettingsUpdatedAt(settings)

    const response: AffiliateSettingsResponse = {
      builderTakerSharePercent,
      builderMakerFlatFeePercent,
      affiliateSharePercent,
      lastUpdated: latestUpdatedAt,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': MUTABLE_API_CACHE_CONTROL,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    unstable_rethrow(error)
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
