'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPublicClient, erc20Abi, formatUnits } from 'viem'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { COLLATERAL_TOKEN_ADDRESS, RESOLUTION_REWARDS_ADDRESS, SECURITY_RESERVE_ADDRESS } from '@/lib/contracts'
import { RESOLUTION_REWARDS_ABI } from '@/lib/resolution-rewards'
import { createViemTransport, defaultViemNetwork, resolveViemRpcUrls } from '@/lib/viem-network'

const REFRESH_INTERVAL_MS = 60_000
function formatUsdcBalance(balance: bigint) {
  const exact = formatUnits(balance, 6)
  const formatted = Number(exact).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return { exact, formatted }
}

export function SecurityReserveBalance() {
  const { polygonRpcUrl } = usePublicRuntimeConfig()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [breakdown, setBreakdown] = useState<{ wallet: bigint; unclaimed: bigint } | null>(null)
  const [failed, setFailed] = useState(false)

  const client = useMemo(
    () =>
      createPublicClient({
        chain: defaultViemNetwork,
        transport: createViemTransport(resolveViemRpcUrls(polygonRpcUrl)),
      }),
    [polygonRpcUrl],
  )

  const loadBalance = useCallback(async () => {
    await Promise.resolve()

    try {
      const [walletBalance, unclaimedBalance] = await Promise.all([
        client.readContract({
          address: COLLATERAL_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [SECURITY_RESERVE_ADDRESS],
        }),
        client.readContract({
          address: RESOLUTION_REWARDS_ADDRESS,
          abi: RESOLUTION_REWARDS_ABI,
          functionName: 'claimable',
          args: [COLLATERAL_TOKEN_ADDRESS, SECURITY_RESERVE_ADDRESS],
        }),
      ])
      setBalance(walletBalance + unclaimedBalance)
      setBreakdown({ wallet: walletBalance, unclaimed: unclaimedBalance })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [client])

  useEffect(() => {
    queueMicrotask(() => void loadBalance())
    const interval = window.setInterval(() => void loadBalance(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [loadBalance])

  const displayBalance = balance === null ? null : formatUsdcBalance(balance)

  return (
    <div className="not-prose my-5 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Security Reserve balance</p>
          <p className="mt-1 text-xs text-muted-foreground">USDC balance + unclaimed · {defaultViemNetwork.name}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`size-1.5 rounded-full ${failed ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
          {failed ? (balance === null ? 'Unavailable' : 'Last read') : 'Live'}
        </span>
      </div>
      <p
        className="mt-3 font-mono text-2xl font-semibold"
        title={
          displayBalance && breakdown
            ? `${formatUsdcBalance(breakdown.wallet).exact} USDC in reserve + ${formatUsdcBalance(breakdown.unclaimed).exact} USDC unclaimed`
            : undefined
        }
      >
        {displayBalance ? `${displayBalance.formatted} USDC` : failed ? 'Unavailable' : 'Loading…'}
      </p>
      {failed && (
        <button className="mt-2 text-xs font-medium text-primary hover:underline" type="button" onClick={loadBalance}>
          Try again
        </button>
      )}
    </div>
  )
}
