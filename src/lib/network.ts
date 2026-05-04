export const POLYGON_MAINNET_CHAIN_ID = 137

export const AMOY_CHAIN_ID = 80_002

export type DefaultNetworkKey = 'amoy' | 'polygon'

export const DEFAULT_NETWORK_KEY: DefaultNetworkKey = 'amoy'

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
