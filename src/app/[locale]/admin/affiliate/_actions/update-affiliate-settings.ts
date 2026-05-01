'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

export interface ForkSettingsActionState {
  error: string | null
}

const UpdateForkSettingsSchema = z.object({
  trade_fee_percent: z.coerce.number().min(0).max(9),
  affiliate_share_percent: z.coerce.number().min(0).max(100),
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
    trade_fee_percent: formData.get('trade_fee_percent'),
    affiliate_share_percent: formData.get('affiliate_share_percent'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const tradeFeeBps = Math.round(parsed.data.trade_fee_percent * 100)
  const affiliateShareBps = Math.round(parsed.data.affiliate_share_percent * 100)

  const { error } = await SettingsRepository.updateSettings([
    { group: 'affiliate', key: 'trade_fee_bps', value: tradeFeeBps.toString() },
    { group: 'affiliate', key: 'affiliate_share_bps', value: affiliateShareBps.toString() },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/affiliate')

  return { error: null }
}
