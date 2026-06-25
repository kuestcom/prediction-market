import type { Chain } from 'viem/chains'
import type { DefaultNetworkKey } from '@/lib/network'
import { polygon, polygonAmoy } from 'viem/chains'
import { DEFAULT_NETWORK_KEY } from '@/lib/network'

const VIEM_NETWORKS_BY_KEY = {
  amoy: polygonAmoy,
  polygon,
} as const satisfies Record<DefaultNetworkKey, Chain>

const VIEM_NETWORKS_BY_CHAIN_ID = new Map<number, Chain>(
  Object.values(VIEM_NETWORKS_BY_KEY).map(network => [network.id, network]),
)

export const defaultViemNetwork = VIEM_NETWORKS_BY_KEY[DEFAULT_NETWORK_KEY]

function resolveDefaultViemRpcUrl() {
  const configuredRpcUrl = process.env.POLYGON_RPC_URL?.trim()
  if (!configuredRpcUrl) {
    return defaultViemNetwork.rpcUrls.default.http[0]
  }

  try {
    const parsedUrl = new URL(configuredRpcUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return configuredRpcUrl
  }
  catch {
    throw new Error('Invalid POLYGON_RPC_URL. Expected an absolute http(s) URL.')
  }
}

export const defaultViemRpcUrl = resolveDefaultViemRpcUrl()

export function resolveViemNetworkByChainId(chainId: number | string | null | undefined) {
  if (typeof chainId === 'number' && Number.isFinite(chainId)) {
    return VIEM_NETWORKS_BY_CHAIN_ID.get(chainId) ?? null
  }

  if (typeof chainId === 'string' && chainId.trim()) {
    const parsed = Number(chainId)
    return Number.isFinite(parsed) ? (VIEM_NETWORKS_BY_CHAIN_ID.get(parsed) ?? null) : null
  }

  return null
}
