'use server'

import type { MarketOrderType } from '@/types'
import { revalidatePath } from 'next/cache'
import { CLOB_ORDER_TYPE, DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'

export async function updateTradingSettingsAction(formData: FormData) {
  try {
    const rawOrderType = (formData.get('market_order_type') || '').toString()
    const marketOrderType = Object.values(CLOB_ORDER_TYPE).includes(rawOrderType as any)
      ? rawOrderType
      : CLOB_ORDER_TYPE.FAK
    const rawShowSlippageWarning = (formData.get('show_slippage_warning') || '').toString()
    const showSlippageWarning = rawShowSlippageWarning === 'true'

    const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const { error } = await UserRepository.updateUserTradingSettings(user, {
      market_order_type: marketOrderType as MarketOrderType,
      show_slippage_warning: showSlippageWarning,
    })

    if (error) {
      return { error }
    }

    revalidatePath('/settings')

    return { error: null }
  }
  catch {
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
