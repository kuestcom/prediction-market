'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  AFFILIATE_SETTINGS_GROUP,
  AFFILIATE_SHARE_BPS_KEY,
  BUILDER_MAKER_FEE_BPS_KEY,
  BUILDER_TAKER_FEE_BPS_KEY,
  getAffiliateFeeSettings,
} from '@/lib/affiliate-fee-settings'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeFeeRecipientWalletAddress } from '@/lib/theme-settings'

export interface ForkSettingsActionState {
  error: string | null
}

function parseRequiredPercentInput(value: unknown) {
  if (typeof value !== 'string') {
    return Number.NaN
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }

  return Number(trimmed)
}

function requiredPercent(max: number) {
  return z.preprocess(
    parseRequiredPercentInput,
    z.number({ error: 'Invalid input.' }).min(0).max(max),
  )
}

const UpdateForkSettingsSchema = z.object({
  builder_taker_fee_percent: requiredPercent(9),
  builder_maker_fee_percent: requiredPercent(9),
  affiliate_share_percent: requiredPercent(100),
})

export async function updateForkSettingsAction(
  _prevState: ForkSettingsActionState,
  formData: FormData,
): Promise<ForkSettingsActionState> {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const parsed = UpdateForkSettingsSchema.safeParse({
    builder_taker_fee_percent: formData.get('builder_taker_fee_percent'),
    builder_maker_fee_percent: formData.get('builder_maker_fee_percent'),
    affiliate_share_percent: formData.get('affiliate_share_percent'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const builderTakerFeeBps = Math.round(parsed.data.builder_taker_fee_percent * 100)
  const builderMakerFeeBps = Math.round(parsed.data.builder_maker_fee_percent * 100)
  const affiliateShareBps = Math.round(parsed.data.affiliate_share_percent * 100)
  const feeRecipientWalletRaw = formData.get('fee_recipient_wallet')
  const feeRecipientWallet = normalizeFeeRecipientWalletAddress(
    typeof feeRecipientWalletRaw === 'string' ? feeRecipientWalletRaw : null,
    'Fee recipient wallet',
  )

  if (feeRecipientWallet.error) {
    return { error: feeRecipientWallet.error }
  }

  const currentSettings = await SettingsRepository.getSettings()
  if (currentSettings.error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const currentAffiliateFeeSettings = getAffiliateFeeSettings(currentSettings.data)
  const currentFeeRecipientWalletRaw = currentSettings.data?.general?.fee_recipient_wallet?.value ?? null
  const currentFeeRecipientWalletNormalized = normalizeFeeRecipientWalletAddress(
    currentFeeRecipientWalletRaw,
    'Fee recipient wallet',
  )
  const currentFeeRecipientWallet = currentFeeRecipientWalletNormalized.error
    ? (typeof currentFeeRecipientWalletRaw === 'string' ? currentFeeRecipientWalletRaw.trim() : '')
    : (currentFeeRecipientWalletNormalized.value ?? '')

  const updates: Array<{ group: string, key: string, value: string }> = []

  if (currentAffiliateFeeSettings.builderTakerFeeBps !== builderTakerFeeBps) {
    updates.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: BUILDER_TAKER_FEE_BPS_KEY,
      value: builderTakerFeeBps.toString(),
    })
  }

  if (currentAffiliateFeeSettings.builderMakerFeeBps !== builderMakerFeeBps) {
    updates.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: BUILDER_MAKER_FEE_BPS_KEY,
      value: builderMakerFeeBps.toString(),
    })
  }

  if (currentAffiliateFeeSettings.affiliateShareBps !== affiliateShareBps) {
    updates.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: AFFILIATE_SHARE_BPS_KEY,
      value: affiliateShareBps.toString(),
    })
  }

  if (currentFeeRecipientWallet.toLowerCase() !== (feeRecipientWallet.value ?? '').toLowerCase()) {
    updates.push({
      group: 'general',
      key: 'fee_recipient_wallet',
      value: feeRecipientWallet.value ?? '',
    })
  }

  if (updates.length === 0) {
    return { error: null }
  }

  const { error } = await SettingsRepository.updateSettings(updates)

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/affiliate')

  return { error: null }
}
