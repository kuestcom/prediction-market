import type { Address } from 'viem'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, formatUnits, getContract, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
import { NATIVE_USDC_TOKEN_ADDRESS } from '@/lib/contracts'
import { IS_TEST_MODE } from '@/lib/network'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

interface Balance {
  raw: number
  rawBase: string
  text: string
  symbol: string
}

const USDC_DECIMALS = 6
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
]
const INITIAL_STATE: Balance = {
  raw: 0.0,
  rawBase: '0',
  text: '0.00',
  symbol: 'USDC',
}
export const PENDING_USDC_QUERY_KEY = 'safe-native-usdc-balance'

interface UsePendingUsdcDepositOptions {
  enabled?: boolean
}

export function usePendingUsdcDeposit(options: UsePendingUsdcDepositOptions = {}) {
  const { isConnected } = useAppKitAccount()
  const user = useUser()

  const rpcUrl = useMemo(
    () => defaultNetwork.rpcUrls.default.http[0],
    [],
  )

  const client = useMemo(
    () =>
      createPublicClient({
        chain: defaultNetwork,
        transport: http(rpcUrl),
      }),
    [rpcUrl],
  )

  const tokenAddress = NATIVE_USDC_TOKEN_ADDRESS

  const contract = useMemo(
    () =>
      getContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        client,
      }),
    [client, tokenAddress],
  )

  const proxyWalletAddress: Address | null = user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address) as Address | null
    : null

  const isOptionsEnabled = (options.enabled ?? true) && !IS_TEST_MODE
  const isAwaitingConnection = Boolean(user && isOptionsEnabled && !isConnected)
  const isQueryEnabled = Boolean(isConnected && proxyWalletAddress && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [PENDING_USDC_QUERY_KEY, proxyWalletAddress, tokenAddress],
    enabled: isQueryEnabled,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Balance> => {
      if (!proxyWalletAddress) {
        return INITIAL_STATE
      }

      try {
        const balanceRaw = await contract.read.balanceOf([proxyWalletAddress]) as bigint
        const balanceFormatted = formatUnits(balanceRaw, USDC_DECIMALS)
        const balanceNumber = Number.parseFloat(balanceFormatted)
        const displayNumber = Number.isFinite(balanceNumber) ? balanceNumber : 0

        return {
          raw: displayNumber,
          rawBase: balanceRaw.toString(),
          text: displayNumber.toFixed(2),
          symbol: 'USDC',
        }
      }
      catch {
        return INITIAL_STATE
      }
    },
  })

  const pendingBalance = isQueryEnabled && data ? data : INITIAL_STATE
  const isWaitingForProxy = Boolean(isConnected && isOptionsEnabled && !proxyWalletAddress)
  const isLoadingPendingDeposit = isAwaitingConnection || isWaitingForProxy || (isQueryEnabled ? (isLoading || (!data && isFetching)) : false)
  const hasPendingDeposit = pendingBalance.rawBase !== '0'

  return {
    pendingBalance,
    hasPendingDeposit,
    isLoadingPendingDeposit,
    refetchPendingDeposit: refetch,
  }
}
