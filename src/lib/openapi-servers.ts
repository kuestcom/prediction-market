import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'

function resolveServerUrl(envValue: string | undefined): string | undefined {
  const value = envValue?.trim()

  if (!value) {
    return undefined
  }

  return value
}

const publicRuntimeEnv = resolvePublicRuntimeEnv(process.env)

export const OPENAPI_SERVER_URLS = {
  clob: resolveServerUrl(publicRuntimeEnv.clobUrl),
  createMarket: resolveServerUrl(publicRuntimeEnv.createMarketUrl),
  community: resolveServerUrl(publicRuntimeEnv.communityUrl),
  dataApi: resolveServerUrl(publicRuntimeEnv.dataUrl),
  gamma: resolveServerUrl(publicRuntimeEnv.gammaUrl),
  priceReference: resolveServerUrl(publicRuntimeEnv.priceReferenceUrl),
  relayer: resolveServerUrl(publicRuntimeEnv.relayerUrl),
} as const
