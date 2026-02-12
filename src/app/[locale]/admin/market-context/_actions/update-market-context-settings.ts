'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

export interface MarketContextSettingsActionState {
  error: string | null
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
    return false
  }

  return fallback
}

const UpdateMarketContextSettingsSchema = z.object({
  market_context_prompt: z.string()
    .min(20, 'Please provide at least 20 characters for the prompt.')
    .max(6000, 'Prompt is too long.'),
  market_context_enabled: z.string().optional(),
}).transform(({ market_context_prompt, market_context_enabled }) => {
  return {
    prompt: market_context_prompt.trim(),
    enabled: normalizeBoolean(market_context_enabled, false),
  }
})

export async function updateMarketContextSettingsAction(
  _prevState: MarketContextSettingsActionState,
  formData: FormData,
): Promise<MarketContextSettingsActionState> {
  const user = await UserRepository.getCurrentUser()

  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const parsed = UpdateMarketContextSettingsSchema.safeParse({
    market_context_prompt: typeof formData.get('market_context_prompt') === 'string'
      ? formData.get('market_context_prompt')
      : '',
    market_context_enabled: typeof formData.get('market_context_enabled') === 'string'
      ? formData.get('market_context_enabled')
      : undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await SettingsRepository.updateSettings([
    { group: 'ai', key: 'market_context_prompt', value: parsed.data.prompt },
    { group: 'ai', key: 'market_context_enabled', value: parsed.data.enabled ? 'true' : 'false' },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/[locale]/admin/market-context', 'page')

  return { error: null }
}
