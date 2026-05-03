'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  AFFILIATE_SETTINGS_GROUP,
  AFFILIATE_SHARE_BPS_KEY,
  BUILDER_MAKER_FEE_BPS_KEY,
  BUILDER_TAKER_FEE_BPS_KEY,
} from '@/lib/affiliate-fee-settings'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

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
  const user = await UserRepository.getCurrentUser()
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

  const { error } = await SettingsRepository.updateSettings([
    { group: AFFILIATE_SETTINGS_GROUP, key: BUILDER_TAKER_FEE_BPS_KEY, value: builderTakerFeeBps.toString() },
    { group: AFFILIATE_SETTINGS_GROUP, key: BUILDER_MAKER_FEE_BPS_KEY, value: builderMakerFeeBps.toString() },
    { group: AFFILIATE_SETTINGS_GROUP, key: AFFILIATE_SHARE_BPS_KEY, value: affiliateShareBps.toString() },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/affiliate')

  return { error: null }
}
