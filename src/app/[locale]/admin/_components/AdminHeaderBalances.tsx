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
import { Link } from '@/i18n/navigation'
import { FEE_CLAIM_EXCHANGE_ADDRESSES } from '@/lib/contracts'
import { baseUnitsToNumber } from '@/lib/data-api/fees'
import { resolveProposerWhitelistAddress } from '@/lib/proposer-whitelist'
import { defaultViemNetwork, resolveViemRpcUrl } from '@/lib/viem-network'
import { useUser } from '@/stores/useUser'

const ADMIN_POL_BALANCE_QUERY_KEY = 'admin-eoa-pol-balance'
const ADMIN_CLAIMABLE_FEES_QUERY_KEY = 'admin-claimable-fees'

const exchangeFeeAbi = [{
  name: 'claimableFees',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

function formatAdminBalance(value: number | null | undefined, decimals = 2) {
  if (!Number.isFinite(value)) {
    return '0.00'
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export default function AdminHeaderBalances({ feeRecipientWallet }: { feeRecipientWallet: string }) {
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
  const normalizedFeeRecipient = useMemo(
    () => isAddress(feeRecipientWallet) ? getAddress(feeRecipientWallet) : null,
    [feeRecipientWallet],
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
  const {
    data: claimableFees,
    isLoading: isLoadingClaimableFees,
  } = useQuery({
    queryKey: [ADMIN_CLAIMABLE_FEES_QUERY_KEY, normalizedFeeRecipient],
    enabled: Boolean(publicClient && normalizedFeeRecipient),
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!normalizedFeeRecipient) {
        return 0
      }
      const results = await Promise.allSettled(FEE_CLAIM_EXCHANGE_ADDRESSES.map(exchange => publicClient.readContract({
        address: exchange,
        abi: exchangeFeeAbi,
        functionName: 'claimableFees',
        args: [normalizedFeeRecipient],
      })))
      const values = results.map((result) => {
        if (result.status === 'rejected') {
          throw new Error('Could not read claimable fees from every exchange.', { cause: result.reason })
        }
        return result.value
      })
      const total = values.reduce((sum, value) => sum + value, 0n)
      return baseUnitsToNumber(total, 6)
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
    <div className="grid grid-cols-3 gap-x-1">
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

      <Button
        asChild
        variant="ghost"
        size="header"
        className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-[6px] px-2.5 py-1"
      >
        <Link href="/admin/affiliate">
          <div className="translate-y-px text-xs/tight font-medium text-muted-foreground">{t('Fees')}</div>
          <div className="-translate-y-px text-base/tight font-semibold text-foreground">
            {isLoadingClaimableFees
              ? <Skeleton className="h-5 w-12" />
              : claimableFees == null
                ? '—'
                : formatAdminBalance(claimableFees)}
          </div>
        </Link>
      </Button>
    </div>
  )
}
