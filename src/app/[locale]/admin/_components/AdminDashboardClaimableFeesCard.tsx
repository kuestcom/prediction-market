'use client'

import { HandCoinsIcon, LoaderCircleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { Link } from '@/i18n/navigation'
import { FEE_CLAIM_EXCHANGE_ADDRESSES } from '@/lib/contracts'
import { baseUnitsToNumber } from '@/lib/data-api/fees'
import { formatCompactCurrency } from '@/lib/formatters'
import { normalizeAddress } from '@/lib/wallet'

const exchangeFeeAbi = [
  {
    name: 'claimableFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

interface AdminDashboardClaimableFeesCardProps {
  feeRecipientWallet: string
}

type ClaimableState
  = | { status: 'loading' }
    | { status: 'ready', value: number }
    | { status: 'unavailable' }

export default function AdminDashboardClaimableFeesCard({
  feeRecipientWallet,
}: AdminDashboardClaimableFeesCardProps) {
  const t = useExtracted()
  const publicClient = usePublicClient()
  const normalizedWallet = normalizeAddress(feeRecipientWallet)
  const [claimable, setClaimable] = useState<ClaimableState>({ status: 'loading' })

  useEffect(() => {
    let isCancelled = false

    if (!publicClient || !normalizedWallet) {
      return
    }

    Promise.all(FEE_CLAIM_EXCHANGE_ADDRESSES.map(exchange => publicClient.readContract({
      address: exchange,
      abi: exchangeFeeAbi,
      functionName: 'claimableFees',
      args: [normalizedWallet],
    })))
      .then((values) => {
        if (isCancelled) {
          return
        }

        const total = values.reduce((sum, value) => sum + value, 0n)
        setClaimable({ status: 'ready', value: baseUnitsToNumber(total, 6) })
      })
      .catch(() => {
        if (!isCancelled) {
          setClaimable({ status: 'unavailable' })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [normalizedWallet, publicClient])

  const value = !normalizedWallet
    ? '—'
    : claimable.status === 'ready'
      ? formatCompactCurrency(claimable.value)
      : claimable.status === 'loading'
        ? null
        : '—'

  return (
    <Link
      href="/admin/affiliate"
      className="
        group flex min-h-44 flex-col rounded-xl border bg-background p-5 transition-colors
        hover:border-foreground/20
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-10 place-items-center rounded-lg border bg-muted/35 text-muted-foreground">
          <HandCoinsIcon className="size-5" aria-hidden />
        </div>
      </div>
      <div className="mt-auto pt-6">
        <div className="flex min-h-10 items-center">
          {value === null
            ? <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" aria-label={t('Loading...')} />
            : <p className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{value}</p>}
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">
          {t({ id: 'adminDashboard.claimableFees', message: 'Claimable fees' })}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t({ id: 'adminDashboard.availableToWithdraw', message: 'Available to withdraw' })}
        </p>
      </div>
    </Link>
  )
}
