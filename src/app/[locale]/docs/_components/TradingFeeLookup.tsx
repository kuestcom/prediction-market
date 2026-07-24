'use client'

import type { FormEvent } from 'react'
import { useId, useState } from 'react'
import { useAffiliateData } from '@/hooks/useAffiliateData'
import { useKuestFeeRate } from '@/hooks/useKuestFeeRate'
import { createTradingFeeRateExample } from '@/lib/affiliate-data'
import { ErrorDisplay, ErrorDisplayBlock } from './ErrorDisplay'

interface TradingFeeLookupProps {
  className?: string
}

export function TradingFeeLookup({ className = '' }: TradingFeeLookupProps) {
  const { data, isLoading } = useAffiliateData()
  const tokenIdInputId = useId()
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [tokenId, setTokenId] = useState('')
  const feeRateQuery = useKuestFeeRate(tokenId)

  function handleTokenIdSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextTokenId = tokenIdInput.trim()
    if (!nextTokenId) {
      return
    }

    if (nextTokenId === tokenId) {
      void feeRateQuery.refetch()
      return
    }

    setTokenId(nextTokenId)
  }

  if (isLoading) {
    return (
      <span className={className}>
        <span className="text-muted-foreground">Loading fee settings...</span>
      </span>
    )
  }

  if (data && !data.success) {
    return (
      <ErrorDisplayBlock
        error={data.error}
        title="Unable to load fee settings"
        className={className}
      />
    )
  }

  if (!data?.success) {
    return null
  }

  const feeRate = feeRateQuery.data === undefined
    ? null
    : createTradingFeeRateExample(data.data, feeRateQuery.data)

  return (
    <div className={className}>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-4">
          <h4 className="mb-3 font-semibold">Trading Fee Lookup</h4>
          <form className="space-y-2" onSubmit={handleTokenIdSubmit}>
            <label className="block text-sm font-medium" htmlFor={tokenIdInputId}>
              Outcome token ID
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={tokenIdInputId}
                type="text"
                value={tokenIdInput}
                onChange={event => setTokenIdInput(event.target.value)}
                placeholder="Paste a token ID"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                type="submit"
                disabled={!tokenIdInput.trim() || feeRateQuery.isFetching}
                className="
                  rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                {feeRateQuery.isFetching ? 'Loading...' : 'Load fee rate'}
              </button>
            </div>
          </form>

          {feeRateQuery.isError && (
            <ErrorDisplay
              error={{ error: 'Unable to load the fee rate for this token. Check the token ID and try again.' }}
              className="mt-3 text-sm"
              showRefresh={false}
            />
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span className="font-medium">Trading fee rate:</span>
            <span className="font-mono font-semibold">
              {feeRate === null
                ? 'Enter token ID'
                : `${feeRate.tradingFeePercent}% (${feeRate.tradingFeeBps} bps)`}
            </span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            This is the live rate parameter, not a dollar quote. The charged amount
            depends on execution price and filled quantity.
          </p>
        </div>
      </div>
    </div>
  )
}
