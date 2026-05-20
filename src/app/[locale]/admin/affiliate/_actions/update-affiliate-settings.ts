'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  AFFILIATE_SETTINGS_GROUP,
  AFFILIATE_SHARE_BPS_KEY,
  BUILDER_MAKER_FEE_BPS_KEY,
  BUILDER_TAKER_FEE_BPS_KEY,
  getAffiliateFeeSettingsUpdatedAt,
} from '@/lib/affiliate-fee-settings'
import { syncBuilderFeesForAdmin } from '@/lib/affiliate-fee-sync'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { ZERO_ADDRESS } from '@/lib/contracts'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeFeeRecipientWalletAddress } from '@/lib/theme-settings'

const GENERAL_SETTINGS_GROUP = 'general'
const FEE_RECIPIENT_WALLET_KEY = 'fee_recipient_wallet'

export interface ForkSettingsActionState {
  error: string | null
}

interface PendingSettingChange {
  group: string
  key: string
  nextValue: string
  previousValue: string | null
  previousUpdatedAt: string | null
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

function shouldUpdateAffiliateBpsSetting(currentValue: string | undefined, nextValue: number) {
  const parsedCurrentValue = currentValue ? Number.parseInt(currentValue, 10) : Number.NaN
  return !Number.isFinite(parsedCurrentValue) || parsedCurrentValue !== nextValue
}

function normalizeStoredFeeRecipientWallet(value: string | null | undefined) {
  const normalized = normalizeFeeRecipientWalletAddress(value, 'Fee recipient wallet')
  if (normalized.error) {
    return typeof value === 'string' ? value.trim() : ''
  }

  return normalized.value ?? ''
}

function resolveStagingUpdatedAt(settings?: Record<string, Record<string, { value: string, updated_at: string }>>) {
  const syncUpdatedAt = getAffiliateFeeSettingsUpdatedAt(settings)
  if (!syncUpdatedAt) {
    return new Date()
  }

  const parsed = new Date(syncUpdatedAt)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function toExistingUpdatedAt(value: string | null, fallback: Date) {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

async function rollbackPendingChanges(changes: PendingSettingChange[], fallbackUpdatedAt: Date) {
  const existingSettings = changes
    .filter(change => change.previousValue !== null)
    .map(change => ({
      group: change.group,
      key: change.key,
      value: change.previousValue ?? '',
      updated_at: toExistingUpdatedAt(change.previousUpdatedAt, fallbackUpdatedAt),
    }))
  const missingSettings = changes
    .filter(change => change.previousValue === null)
    .map(change => ({
      group: change.group,
      key: change.key,
    }))

  if (existingSettings.length > 0) {
    const rollbackExisting = await SettingsRepository.upsertSettingsWithUpdatedAt(existingSettings)
    if (rollbackExisting.error) {
      throw new Error(DEFAULT_ERROR_MESSAGE)
    }
  }

  if (missingSettings.length > 0) {
    const rollbackMissing = await SettingsRepository.deleteSettings(missingSettings)
    if (rollbackMissing.error) {
      throw new Error(DEFAULT_ERROR_MESSAGE)
    }
  }
}

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

  const depositWallet = normalizeFeeRecipientWalletAddress(
    user.deposit_wallet_address ?? null,
    'Deposit Wallet',
  )
  if (
    depositWallet.error
    || !depositWallet.value
    || depositWallet.value.toLowerCase() === ZERO_ADDRESS.toLowerCase()
  ) {
    return { error: 'Set up your Deposit Wallet first.' }
  }

  const submittedFeeRecipientWallet = normalizeFeeRecipientWalletAddress(
    typeof formData.get('fee_recipient_wallet') === 'string'
      ? formData.get('fee_recipient_wallet') as string
      : null,
    'Fee recipient wallet',
  )
  if (submittedFeeRecipientWallet.error) {
    return { error: submittedFeeRecipientWallet.error }
  }

  if ((submittedFeeRecipientWallet.value ?? '').toLowerCase() !== depositWallet.value.toLowerCase()) {
    return { error: 'Fee wallet must match your Deposit Wallet.' }
  }

  const builderTakerFeeBps = Math.round(parsed.data.builder_taker_fee_percent * 100)
  const builderMakerFeeBps = Math.round(parsed.data.builder_maker_fee_percent * 100)
  const affiliateShareBps = Math.round(parsed.data.affiliate_share_percent * 100)
  const currentSettings = await SettingsRepository.getSettings()
  if (currentSettings.error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const currentAffiliateSettings = currentSettings.data?.affiliate
  const currentFeeRecipientWalletRaw = currentSettings.data?.general?.fee_recipient_wallet?.value ?? null
  const currentFeeRecipientWallet = normalizeStoredFeeRecipientWallet(currentFeeRecipientWalletRaw)
  const pendingChanges: PendingSettingChange[] = []

  if (shouldUpdateAffiliateBpsSetting(
    currentAffiliateSettings?.[BUILDER_TAKER_FEE_BPS_KEY]?.value,
    builderTakerFeeBps,
  )) {
    pendingChanges.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: BUILDER_TAKER_FEE_BPS_KEY,
      nextValue: builderTakerFeeBps.toString(),
      previousValue: currentAffiliateSettings?.[BUILDER_TAKER_FEE_BPS_KEY]?.value ?? null,
      previousUpdatedAt: currentAffiliateSettings?.[BUILDER_TAKER_FEE_BPS_KEY]?.updated_at ?? null,
    })
  }

  if (shouldUpdateAffiliateBpsSetting(
    currentAffiliateSettings?.[BUILDER_MAKER_FEE_BPS_KEY]?.value,
    builderMakerFeeBps,
  )) {
    pendingChanges.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: BUILDER_MAKER_FEE_BPS_KEY,
      nextValue: builderMakerFeeBps.toString(),
      previousValue: currentAffiliateSettings?.[BUILDER_MAKER_FEE_BPS_KEY]?.value ?? null,
      previousUpdatedAt: currentAffiliateSettings?.[BUILDER_MAKER_FEE_BPS_KEY]?.updated_at ?? null,
    })
  }

  if (shouldUpdateAffiliateBpsSetting(
    currentAffiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.value,
    affiliateShareBps,
  )) {
    pendingChanges.push({
      group: AFFILIATE_SETTINGS_GROUP,
      key: AFFILIATE_SHARE_BPS_KEY,
      nextValue: affiliateShareBps.toString(),
      previousValue: currentAffiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.value ?? null,
      previousUpdatedAt: currentAffiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.updated_at ?? null,
    })
  }

  if (currentFeeRecipientWallet.toLowerCase() !== depositWallet.value.toLowerCase()) {
    pendingChanges.push({
      group: GENERAL_SETTINGS_GROUP,
      key: FEE_RECIPIENT_WALLET_KEY,
      nextValue: depositWallet.value,
      previousValue: currentFeeRecipientWalletRaw,
      previousUpdatedAt: currentSettings.data?.general?.fee_recipient_wallet?.updated_at ?? null,
    })
  }

  if (pendingChanges.length === 0) {
    return { error: null }
  }

  const requiresSync = pendingChanges.some(change =>
    (change.group === GENERAL_SETTINGS_GROUP && change.key === FEE_RECIPIENT_WALLET_KEY)
    || (change.group === AFFILIATE_SETTINGS_GROUP && (
      change.key === BUILDER_TAKER_FEE_BPS_KEY
      || change.key === BUILDER_MAKER_FEE_BPS_KEY
    )),
  )

  if (!requiresSync) {
    const { error } = await SettingsRepository.updateSettings(pendingChanges.map(change => ({
      group: change.group,
      key: change.key,
      value: change.nextValue,
    })))

    if (error) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    revalidatePath('/admin/affiliate')
    return { error: null }
  }

  const stagingUpdatedAt = resolveStagingUpdatedAt(currentSettings.data ?? undefined)
  const stagedChanges = pendingChanges.map(change => ({
    group: change.group,
    key: change.key,
    value: change.nextValue,
    updated_at: toExistingUpdatedAt(change.previousUpdatedAt, stagingUpdatedAt),
  }))

  const stagedUpdate = await SettingsRepository.upsertSettingsWithUpdatedAt(stagedChanges)
  if (stagedUpdate.error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  try {
    await syncBuilderFeesForAdmin({
      id: user.id,
      address: user.address,
    }, {
      feeRecipientWallet: depositWallet.value,
      builderTakerFeeBps,
      builderMakerFeeBps,
    })
  }
  catch (error) {
    try {
      await rollbackPendingChanges(pendingChanges, stagingUpdatedAt)
    }
    catch (rollbackError) {
      console.error('Failed to rollback affiliate settings after sync error', rollbackError)
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    return {
      error: error instanceof Error && error.message
        ? error.message
        : DEFAULT_ERROR_MESSAGE,
    }
  }

  const finalizedAt = new Date()
  const finalizeResult = await SettingsRepository.touchSettings(
    pendingChanges.map(change => ({
      group: change.group,
      key: change.key,
    })),
    finalizedAt,
  )
  if (finalizeResult.error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/affiliate')

  return { error: null }
}
