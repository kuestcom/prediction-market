'use server'

import type { MarketOrderType } from '@/types'
import { revalidatePath } from 'next/cache'
import { CLOB_ORDER_TYPE, DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'

export async function updateTradingSettingsAction(formData: FormData) {
  try {
    const preferences: {
      market_order_type?: MarketOrderType
      show_slippage_warning?: boolean
    } = {}

    if (formData.has('market_order_type')) {
      const rawOrderType = (formData.get('market_order_type') || '').toString()
      const marketOrderType = Object.values(CLOB_ORDER_TYPE).includes(rawOrderType as any)
        ? rawOrderType
        : CLOB_ORDER_TYPE.FAK
      preferences.market_order_type = marketOrderType as MarketOrderType
    }

    if (formData.has('show_slippage_warning')) {
      const rawShowSlippageWarning = (formData.get('show_slippage_warning') || '').toString()
      preferences.show_slippage_warning = rawShowSlippageWarning === 'true'
    }

    const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const { error } = await UserRepository.updateUserTradingSettings(user, preferences)

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
