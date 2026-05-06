import type { Address, PublicClient } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { createPublicClient, getContract, http } from 'viem'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

interface Balance {
  raw: number
  text: string
  symbol: string
}

export const DEPOSIT_WALLET_BALANCE_QUERY_KEY = 'deposit-wallet-usdc-balance'

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

function createBrowserPublicClient(): PublicClient {
  return createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })
}

export function useBalance(options: UseBalanceOptions = {}) {
  const user = useUser()
  const clientRef = useRef<PublicClient | null>(null)
  if (clientRef.current === null && typeof window !== 'undefined') {
    clientRef.current = createBrowserPublicClient()
  }
  const client = clientRef.current

  const proxyWalletAddress: Address | null = user?.deposit_wallet_address
    ? normalizeAddress(user.deposit_wallet_address) as Address | null
    : null

  const contract = useMemo(() => {
    if (!client || !proxyWalletAddress) {
      return null
    }

    return getContract({
      address: COLLATERAL_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      client,
    })
  }, [client, proxyWalletAddress])

  const isOptionsEnabled = options.enabled ?? true
  const isQueryEnabled = Boolean(client && proxyWalletAddress && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY, proxyWalletAddress],
    enabled: isQueryEnabled,
    staleTime: 'static',
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Balance> => {
      if (!client || !proxyWalletAddress || !contract) {
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
  const isLoadingBalance = isQueryEnabled ? (isLoading || (!data && isFetching)) : false

  return {
    balance,
    isLoadingBalance,
    refetchBalance: refetch,
  }
}
