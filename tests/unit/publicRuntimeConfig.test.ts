import { describe, expect, it } from 'vitest'
import {
  defaultPublicRuntimeConfig,
  resolvePublicRuntimeEnv,
} from '@/lib/public-runtime-config.shared'

const RUNTIME_ENV_KEYS_BY_CONFIG_KEY = {
  clobUrl: 'CLOB_URL',
  communityUrl: 'COMMUNITY_URL',
  createMarketUrl: 'CREATE_MARKET_URL',
  dataUrl: 'DATA_URL',
  gammaUrl: 'GAMMA_URL',
  geoblockUrl: 'GEOBLOCK_URL',
  chainId: 'CHAIN_ID',
  polygonRpcUrl: 'POLYGON_RPC_URL',
  priceReferenceUrl: 'PRICE_REFERENCE_URL',
  relayerUrl: 'RELAYER_URL',
  reownAppKitProjectId: 'REOWN_APPKIT_PROJECT_ID',
  sdkDownloadUrl: 'SDK_DOWNLOAD_URL',
  sentryDsn: 'SENTRY_DSN',
  userPnlUrl: 'USER_PNL_URL',
  wsClobUrl: 'WS_CLOB_URL',
  wsLiveDataUrl: 'WS_LIVE_DATA_URL',
} as const satisfies Record<keyof Omit<typeof defaultPublicRuntimeConfig, 'commitSha' | 'isVercel' | 'siteUrl'>, string>

const KUEST_DEFAULT_CONFIG_KEYS = Object.entries(defaultPublicRuntimeConfig)
  .filter(([, value]) => typeof value === 'string' && value.includes('.kuest.com'))
  .map(([key]) => key as keyof typeof RUNTIME_ENV_KEYS_BY_CONFIG_KEY)

describe('public runtime config resolution', () => {
  it('uses Kuest defaults for blank Kuest service URLs', () => {
    const config = resolvePublicRuntimeEnv({})

    for (const key of KUEST_DEFAULT_CONFIG_KEYS) {
      expect(config[key]).toBe(defaultPublicRuntimeConfig[key])
    }
  })

  it('uses Kuest defaults when Kuest service URL env values are blank', () => {
    const env = Object.fromEntries(
      KUEST_DEFAULT_CONFIG_KEYS.map(key => [RUNTIME_ENV_KEYS_BY_CONFIG_KEY[key], ' ']),
    )
    const config = resolvePublicRuntimeEnv(env)

    for (const key of KUEST_DEFAULT_CONFIG_KEYS) {
      expect(config[key]).toBe(defaultPublicRuntimeConfig[key])
    }
  })

  it('allows Kuest service URL env values to override defaults', () => {
    const env = Object.fromEntries(
      KUEST_DEFAULT_CONFIG_KEYS.map(key => [RUNTIME_ENV_KEYS_BY_CONFIG_KEY[key], `https://override.example/${key}`]),
    )
    const config = resolvePublicRuntimeEnv(env)

    for (const key of KUEST_DEFAULT_CONFIG_KEYS) {
      expect(config[key]).toBe(`https://override.example/${key}`)
    }
  })

  it('parses CHAIN_ID from the environment', () => {
    expect(resolvePublicRuntimeEnv({ CHAIN_ID: '137' }).chainId).toBe(137)
    expect(resolvePublicRuntimeEnv({ CHAIN_ID: ' ' }).chainId).toBe(defaultPublicRuntimeConfig.chainId)
  })
})
