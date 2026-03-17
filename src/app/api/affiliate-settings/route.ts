import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'

interface AffiliateSettingsResponse {
  tradeFeePercent: number
  affiliateSharePercent: number
  platformSharePercent: number
  lastUpdated?: string
}

export async function GET() {
  try {
    const { data: settings, error } = await SettingsRepository.getSettings()

    if (error || !settings?.affiliate) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const affiliateSettings = settings.affiliate
    const tradeFeeBps = affiliateSettings.trade_fee_bps?.value
    const affiliateShareBps = affiliateSettings.affiliate_share_bps?.value

    if (!tradeFeeBps || !affiliateShareBps) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const tradeFeePercent = Number.parseFloat(tradeFeeBps) / 100
    const affiliateSharePercent = Number.parseFloat(affiliateShareBps) / 100
    const platformSharePercent = 100 - affiliateSharePercent

    if (Number.isNaN(tradeFeePercent) || Number.isNaN(affiliateSharePercent)) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const lastUpdated = Math.max(
      new Date(affiliateSettings.trade_fee_bps?.updated_at || 0).getTime(),
      new Date(affiliateSettings.affiliate_share_bps?.updated_at || 0).getTime(),
    )

    const response: AffiliateSettingsResponse = {
      tradeFeePercent,
      affiliateSharePercent,
      platformSharePercent,
      lastUpdated: new Date(lastUpdated).toISOString(),
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
