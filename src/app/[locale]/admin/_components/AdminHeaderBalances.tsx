'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { createPublicClient, formatUnits, getAddress, http, isAddress } from 'viem'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBalance } from '@/hooks/useBalance'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { resolveProposerWhitelistAddress } from '@/lib/proposer-whitelist'
import { defaultViemNetwork, resolveViemRpcUrl } from '@/lib/viem-network'
import { useUser } from '@/stores/useUser'

const ADMIN_POL_BALANCE_QUERY_KEY = 'admin-eoa-pol-balance'

function formatAdminBalance(value: number | null | undefined, decimals = 2) {
  if (!Number.isFinite(value)) {
    return '0.00'
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export default function AdminHeaderBalances() {
  const t = useExtracted()
  const user = useUser()
  const { polygonRpcUrl } = usePublicRuntimeConfig()
  const rpcUrl = useMemo(() => resolveViemRpcUrl(polygonRpcUrl), [polygonRpcUrl])
  const { address: connectedAddress } = useAppKitAccount()
  const publicClient = useMemo(
    () => createPublicClient({
      chain: defaultViemNetwork,
      transport: http(rpcUrl),
    }),
    [rpcUrl],
  )
  const eoaAddress = useMemo(
    () => resolveProposerWhitelistAddress(connectedAddress, user?.address),
    [connectedAddress, user?.address],
  )
  const normalizedEoaAddress = useMemo(
    () => eoaAddress && isAddress(eoaAddress) ? getAddress(eoaAddress) : null,
    [eoaAddress],
  )
  const { balance: usdcBalance, isLoadingBalance: isLoadingUsdcBalance } = useBalance({
    enabled: Boolean(normalizedEoaAddress),
    depositWalletAddress: normalizedEoaAddress,
  })
  const { data: polBalance, isLoading: isLoadingPolBalance } = useQuery({
    queryKey: [ADMIN_POL_BALANCE_QUERY_KEY, normalizedEoaAddress],
    enabled: Boolean(publicClient && normalizedEoaAddress),
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!publicClient || !normalizedEoaAddress) {
        return 0
      }

      const rawBalance = await publicClient.getBalance({ address: normalizedEoaAddress })
      return Number(formatUnits(rawBalance, 18))
    },
  })

  const handleCopyEoa = useCallback(async () => {
    if (!normalizedEoaAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(normalizedEoaAddress)
      toast.success(t('EOA wallet copied.'))
    }
    catch (error) {
      console.error('Failed to copy admin EOA wallet address:', error)
      toast.error(t('Could not copy EOA wallet.'))
    }
  }, [normalizedEoaAddress, t])

  return (
    <div className="grid grid-cols-2 gap-x-1">
      <Button
        type="button"
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
        onClick={() => void handleCopyEoa()}
        disabled={!normalizedEoaAddress}
      >
        <div className="translate-y-px text-xs/tight font-medium text-muted-foreground">{t('Admin POL')}</div>
        <div className="-translate-y-px text-base/tight font-semibold text-foreground">
          {isLoadingPolBalance
            ? <Skeleton className="h-5 w-12" />
            : formatAdminBalance(polBalance)}
        </div>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
        onClick={() => void handleCopyEoa()}
        disabled={!normalizedEoaAddress}
      >
        <div className="translate-y-px text-xs/tight font-medium text-muted-foreground">{t('Admin USDC')}</div>
        <div className="-translate-y-px text-base/tight font-semibold text-foreground">
          {isLoadingUsdcBalance
            ? <Skeleton className="h-5 w-12" />
            : formatAdminBalance(usdcBalance.raw)}
        </div>
      </Button>
    </div>
  )
}
