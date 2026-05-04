import { polygonAmoy } from 'viem/chains'

export const defaultViemNetwork = polygonAmoy
export const defaultViemRpcUrl = defaultViemNetwork.rpcUrls.default.http[0]
