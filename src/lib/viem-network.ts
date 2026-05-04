import type { Chain } from 'viem/chains'
import type { DefaultNetworkKey } from '@/lib/network'
import { polygon, polygonAmoy } from 'viem/chains'
import { DEFAULT_NETWORK_KEY } from '@/lib/network'

const VIEM_NETWORKS_BY_KEY = {
  amoy: polygonAmoy,
  polygon,
} as const satisfies Record<DefaultNetworkKey, Chain>

export const defaultViemNetwork = VIEM_NETWORKS_BY_KEY[DEFAULT_NETWORK_KEY]
export const defaultViemRpcUrl = defaultViemNetwork.rpcUrls.default.http[0]
