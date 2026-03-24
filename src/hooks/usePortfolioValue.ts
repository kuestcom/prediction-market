import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const DATA_API_URL = process.env.DATA_URL!
const { useSession } = authClient

interface PortfolioValueResult {
  value: number
  text: string
  isLoading: boolean
  isFetching: boolean
}

interface PortfolioValueOptions {
  useDefaultUser?: boolean
}

export function usePortfolioValue(
  walletAddress?: string | null,
  options: PortfolioValueOptions = {},
): PortfolioValueResult {
  const { data: session, isPending: isSessionPending } = useSession()
  const user = useUser()
  const hasAuthenticatedSession = Boolean(session?.user)
  const useDefaultUser = options.useDefaultUser ?? true
  const isUsingSessionWallet = !walletAddress && useDefaultUser
  const userProxyWallet = hasAuthenticatedSession && user?.proxy_wallet_status === 'deployed' && user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address)
    : null
  const targetWallet = walletAddress
    ? normalizeAddress(walletAddress)
    : (isUsingSessionWallet ? userProxyWallet : null)
  const isWaitingForSession = Boolean(
    isUsingSessionWallet && (isSessionPending || (user && !hasAuthenticatedSession)),
  )
  const isWaitingForProxy = Boolean(isUsingSessionWallet && hasAuthenticatedSession && !userProxyWallet)

  const {
    data,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['portfolio-value', targetWallet],
    enabled: Boolean(targetWallet) && (!isUsingSessionWallet || hasAuthenticatedSession),
    staleTime: 'static',
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<number> => {
      if (!targetWallet) {
        return 0
      }

      const response = await fetch(`${DATA_API_URL}/value?user=${targetWallet}`)
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio value')
      }

      const body = await response.json()

      return body[0]?.value || 0
    },
  })

  const value = data ?? 0
  const text = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isInitialLoading = isWaitingForSession || isWaitingForProxy || (isLoading && !data)

  return {
    value,
    text,
    isLoading: isInitialLoading,
    isFetching,
  }
}
