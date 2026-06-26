export const POLYGON_MAINNET_CHAIN_ID = 137

export const AMOY_CHAIN_ID = 80_002

export type DefaultNetworkKey = 'amoy' | 'polygon'

export function parseNetworkChainId(value: string | number | null | undefined, fallback = AMOY_CHAIN_ID) {
  const parsed = typeof value === 'number' ? value : Number(value?.trim() ?? '')
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getRuntimeChainId() {
  if (typeof window !== 'undefined') {
    const runtimeChainId = window.__PUBLIC_RUNTIME_CONFIG__?.chainId
    if (runtimeChainId !== undefined) {
      return runtimeChainId
    }
  }

  if (typeof process !== 'undefined') {
    return process.env.CHAIN_ID
  }

  return undefined
}

function resolveNetworkKeyByChainId(chainId: string | number | null | undefined): DefaultNetworkKey {
  return parseNetworkChainId(chainId) === POLYGON_MAINNET_CHAIN_ID ? 'polygon' : 'amoy'
}

export const DEFAULT_NETWORK_KEY: DefaultNetworkKey = resolveNetworkKeyByChainId(getRuntimeChainId())

const NETWORK_CONFIG = {
  amoy: {
    chainId: AMOY_CHAIN_ID,
    isTestMode: true,
    polygonScanBase: 'https://amoy.polygonscan.com',
  },
  polygon: {
    chainId: POLYGON_MAINNET_CHAIN_ID,
    isTestMode: false,
    polygonScanBase: 'https://polygonscan.com',
  },
} as const satisfies Record<DefaultNetworkKey, {
  chainId: number
  isTestMode: boolean
  polygonScanBase: string
}>

const defaultNetworkConfig = NETWORK_CONFIG[DEFAULT_NETWORK_KEY]

export const DEFAULT_CHAIN_ID = defaultNetworkConfig.chainId

export const IS_TEST_MODE = defaultNetworkConfig.isTestMode

export const POLYGON_SCAN_BASE = defaultNetworkConfig.polygonScanBase
