import { NextResponse } from 'next/server'
import { AFFILIATE_SHARE_BPS_KEY, getAffiliateFeeSettings } from '@/lib/affiliate-fee-settings'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { ZERO_ADDRESS } from '@/lib/contracts'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

const GENERAL_SETTINGS_GROUP = 'general'
const FEE_RECIPIENT_WALLET_KEY = 'fee_recipient_wallet'

function getFeeRecipientAddress(settings?: Record<string, Record<string, { value: string, updated_at: string }>>) {
  const address = settings?.[GENERAL_SETTINGS_GROUP]?.[FEE_RECIPIENT_WALLET_KEY]?.value
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
    ? address as `0x${string}`
    : ZERO_ADDRESS
}

export async function GET() {
  try {
    const { data: settings } = await SettingsRepository.getSettings()
    const referrerAddress = getFeeRecipientAddress(settings ?? undefined)
    const affiliateSettings = settings?.affiliate
    const { builderTakerFeeBps, builderMakerFeeBps } = getAffiliateFeeSettings(settings)

    const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })

    if (!user) {
      return NextResponse.json({
        referrerAddress,
        affiliateAddress: ZERO_ADDRESS,
        affiliateSharePercent: 0,
        builderTakerFeeBps,
        builderMakerFeeBps,
      })
    }

    let affiliateAddress = ZERO_ADDRESS
    let affiliateSharePercent = 0

    if (user.referred_by_user_id) {
      const { data: affiliateUsers } = await UserRepository.getUsersByIds([user.referred_by_user_id])
      const affiliateUser = affiliateUsers?.[0]

      const candidate = affiliateUser?.deposit_wallet_address || affiliateUser?.address
      if (candidate && /^0x[0-9a-fA-F]{40}$/.test(candidate)) {
        affiliateAddress = candidate as `0x${string}`
        const shareBps = affiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.value

        if (shareBps) {
          const parsed = Number.parseInt(shareBps, 10)
          if (Number.isFinite(parsed) && parsed > 0) {
            affiliateSharePercent = Math.round(parsed / 100)
          }
        }
      }
    }

    return NextResponse.json({
      referrerAddress,
      affiliateAddress,
      affiliateSharePercent,
      builderTakerFeeBps,
      builderMakerFeeBps,
    })
  }
  catch (error) {
    console.error('Failed to load affiliate info', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
