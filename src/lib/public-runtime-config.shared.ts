import { AMOY_CHAIN_ID, parseNetworkChainId } from '@/lib/network'

export interface PublicRuntimeConfig {
  clobUrl: string
  commitSha: string
  communityUrl: string
  createMarketUrl: string
  dataUrl: string
  gammaUrl: string
  geoblockUrl: string
  isVercel: string
  chainId: number
  polygonRpcUrl: string
  priceReferenceUrl: string
  relayerUrl: string
  reownAppKitProjectId: string
  sdkDownloadUrl: string
  sentryDsn: string
  siteUrl: string
  userPnlUrl: string
  wsClobUrl: string
  wsLiveDataUrl: string
}

export const defaultPublicRuntimeConfig: PublicRuntimeConfig = {
  clobUrl: 'https://clob.kuest.com',
  commitSha: 'unknown',
  communityUrl: 'https://community.kuest.com',
  createMarketUrl: 'https://create-market.kuest.com',
  dataUrl: 'https://data-api.kuest.com',
  gammaUrl: 'https://gamma-api.kuest.com',
  geoblockUrl: 'https://geoblock.kuest.com',
  isVercel: 'false',
  chainId: AMOY_CHAIN_ID,
  polygonRpcUrl: '',
  priceReferenceUrl: 'https://price-reference.kuest.com',
  relayerUrl: 'https://relayer.kuest.com',
  reownAppKitProjectId: '',
  sdkDownloadUrl: 'https://sdk-download.kuest.com',
  sentryDsn: '',
  siteUrl: 'http://localhost:3000',
  userPnlUrl: 'https://user-pnl-api.kuest.com',
  wsClobUrl: 'wss://ws-subscriptions-clob.kuest.com',
  wsLiveDataUrl: 'wss://ws-live-data.kuest.com',
}

export function normalizePublicRuntimeEnvValue(value: string | undefined, fallback = '') {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

export function resolvePublicRuntimeEnv(env: NodeJS.ProcessEnv): Omit<PublicRuntimeConfig, 'commitSha' | 'siteUrl'> {
  return {
    clobUrl: normalizePublicRuntimeEnvValue(env.CLOB_URL, defaultPublicRuntimeConfig.clobUrl),
    communityUrl: normalizePublicRuntimeEnvValue(env.COMMUNITY_URL, defaultPublicRuntimeConfig.communityUrl),
    createMarketUrl: normalizePublicRuntimeEnvValue(env.CREATE_MARKET_URL, defaultPublicRuntimeConfig.createMarketUrl),
    dataUrl: normalizePublicRuntimeEnvValue(env.DATA_URL, defaultPublicRuntimeConfig.dataUrl),
    gammaUrl: normalizePublicRuntimeEnvValue(env.GAMMA_URL, defaultPublicRuntimeConfig.gammaUrl),
    geoblockUrl: normalizePublicRuntimeEnvValue(env.GEOBLOCK_URL, defaultPublicRuntimeConfig.geoblockUrl),
    isVercel: env.VERCEL_ENV ? 'true' : 'false',
    chainId: parseNetworkChainId(env.CHAIN_ID, defaultPublicRuntimeConfig.chainId),
    polygonRpcUrl: normalizePublicRuntimeEnvValue(env.POLYGON_RPC_URL),
    priceReferenceUrl: normalizePublicRuntimeEnvValue(env.PRICE_REFERENCE_URL, defaultPublicRuntimeConfig.priceReferenceUrl),
    relayerUrl: normalizePublicRuntimeEnvValue(env.RELAYER_URL, defaultPublicRuntimeConfig.relayerUrl),
    reownAppKitProjectId: normalizePublicRuntimeEnvValue(env.REOWN_APPKIT_PROJECT_ID),
    sdkDownloadUrl: normalizePublicRuntimeEnvValue(env.SDK_DOWNLOAD_URL, defaultPublicRuntimeConfig.sdkDownloadUrl),
    sentryDsn: normalizePublicRuntimeEnvValue(env.SENTRY_DSN),
    userPnlUrl: normalizePublicRuntimeEnvValue(env.USER_PNL_URL, defaultPublicRuntimeConfig.userPnlUrl),
    wsClobUrl: normalizePublicRuntimeEnvValue(env.WS_CLOB_URL, defaultPublicRuntimeConfig.wsClobUrl),
    wsLiveDataUrl: normalizePublicRuntimeEnvValue(env.WS_LIVE_DATA_URL, defaultPublicRuntimeConfig.wsLiveDataUrl),
  }
}
