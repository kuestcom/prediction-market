export const AFFILIATE_SETTINGS_GROUP = 'affiliate'
export const BUILDER_TAKER_FEE_BPS_KEY = 'builder_taker_fee_bps'
export const BUILDER_MAKER_FEE_BPS_KEY = 'builder_maker_fee_bps'
export const AFFILIATE_SHARE_BPS_KEY = 'affiliate_share_bps'

const DEFAULT_BUILDER_TAKER_FEE_BPS = 100
const DEFAULT_BUILDER_MAKER_FEE_BPS = 0
const DEFAULT_AFFILIATE_SHARE_BPS = 5000

interface SettingsValue {
  value: string
  updated_at: string
}

export type SettingsGroups = Record<string, Record<string, SettingsValue>>

export interface AffiliateFeeSettings {
  builderTakerFeeBps: number
  builderMakerFeeBps: number
  affiliateShareBps: number
}

function parseBpsSetting(value: string | undefined, fallback: number) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function getAffiliateFeeSettings(settings?: SettingsGroups | null): AffiliateFeeSettings {
  const affiliateSettings = settings?.[AFFILIATE_SETTINGS_GROUP]

  return {
    builderTakerFeeBps: parseBpsSetting(
      affiliateSettings?.[BUILDER_TAKER_FEE_BPS_KEY]?.value,
      DEFAULT_BUILDER_TAKER_FEE_BPS,
    ),
    builderMakerFeeBps: parseBpsSetting(
      affiliateSettings?.[BUILDER_MAKER_FEE_BPS_KEY]?.value,
      DEFAULT_BUILDER_MAKER_FEE_BPS,
    ),
    affiliateShareBps: parseBpsSetting(
      affiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.value,
      DEFAULT_AFFILIATE_SHARE_BPS,
    ),
  }
}

export function getAffiliateFeeSettingsUpdatedAt(settings?: SettingsGroups | null) {
  const affiliateSettings = settings?.[AFFILIATE_SETTINGS_GROUP]
  const timestamps = [
    affiliateSettings?.[BUILDER_TAKER_FEE_BPS_KEY]?.updated_at,
    affiliateSettings?.[BUILDER_MAKER_FEE_BPS_KEY]?.updated_at,
    affiliateSettings?.[AFFILIATE_SHARE_BPS_KEY]?.updated_at,
  ].filter((value): value is string => Boolean(value))

  return timestamps.reduce<string | undefined>((latest, timestamp) => {
    if (!latest) {
      return timestamp
    }

    const latestMs = Date.parse(latest)
    const timestampMs = Date.parse(timestamp)

    if (!Number.isFinite(timestampMs)) {
      return latest
    }

    return Number.isFinite(latestMs) && latestMs > timestampMs ? latest : timestamp
  }, undefined)
}

export function bpsToPercent(bps: number) {
  return bps / 100
}

export function formatBpsPercent(bps: number) {
  const value = bpsToPercent(bps)
  const fixed = value.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}
