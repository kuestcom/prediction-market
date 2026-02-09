import type { Address, PublicClient } from 'viem'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, getContract, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

interface Balance {
  raw: number
  text: string
  symbol: string
}

export const SAFE_BALANCE_QUERY_KEY = 'safe-usdc-balance'

const USDC_DECIMALS = 6
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
]
const INITIAL_STATE: Balance = {
  raw: 0.0,
  text: '0.00',
  symbol: 'USDC',
}

interface UseBalanceOptions {
  enabled?: boolean
}

const RPC_URL = defaultNetwork.rpcUrls.default.http[0]

export function useBalance(options: UseBalanceOptions = {}) {
  const { isConnected } = useAppKitAccount()
  const user = useUser()

  const client = useMemo<PublicClient | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return createPublicClient({
      chain: defaultNetwork,
      transport: http(RPC_URL),
    })
  }, [])

  const contract = useMemo(() => {
    if (!client) {
      return null
    }

    return getContract({
      address: COLLATERAL_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      client,
    })
  }, [client])

  const proxyWalletAddress: Address | null = user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address) as Address | null
    : null

  const isOptionsEnabled = options.enabled ?? true
  const isAwaitingConnection = Boolean(user && isOptionsEnabled && !isConnected)
  const isQueryEnabled = Boolean(client && isConnected && proxyWalletAddress && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [SAFE_BALANCE_QUERY_KEY, proxyWalletAddress],
    enabled: isQueryEnabled,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Balance> => {
      if (!proxyWalletAddress || !contract) {
        return INITIAL_STATE
      }

      try {
        const balanceRaw = await contract.read.balanceOf([proxyWalletAddress])
        const balanceNumber = Number(balanceRaw) / 10 ** USDC_DECIMALS

        return {
          raw: balanceNumber,
          text: balanceNumber.toFixed(2),
          symbol: 'USDC',
        }
      }
      catch {
        return INITIAL_STATE
      }
    },
  })

  const balance = isQueryEnabled && data ? data : INITIAL_STATE
  const isWaitingForProxy = Boolean(isConnected && isOptionsEnabled && !proxyWalletAddress)
  const isLoadingBalance = isAwaitingConnection || isWaitingForProxy || (isQueryEnabled ? (isLoading || (!data && isFetching)) : false)
  return {
    balance,
    isLoadingBalance,
    refetchBalance: refetch,
  }
}
