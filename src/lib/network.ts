export const POLYGON_MAINNET_CHAIN_ID = 137

export const AMOY_CHAIN_ID = 80_002

export const DEFAULT_CHAIN_ID = AMOY_CHAIN_ID

export const IS_TEST_MODE = DEFAULT_CHAIN_ID === AMOY_CHAIN_ID

export const POLYGON_SCAN_BASE = IS_TEST_MODE
  ? 'https://amoy.polygonscan.com'
  : 'https://polygonscan.com'
