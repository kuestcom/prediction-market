'use client'

import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useAffiliateData } from '@/hooks/useAffiliateData'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { createFeeCalculationExample } from '@/lib/affiliate-data'
import { fetchKuestFeeRate } from '@/lib/clob'
import { ErrorDisplay, ErrorDisplayBlock } from './ErrorDisplay'

interface FeeCalculationExampleProps {
  amount: number
  className?: string
  format?: 'table' | 'inline'
}

export function FeeCalculationExample({ amount, className = '', format = 'table' }: FeeCalculationExampleProps) {
  const { data, isLoading } = useAffiliateData()
  const { clobUrl } = usePublicRuntimeConfig()
  const tokenIdInputId = useId()
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [tokenId, setTokenId] = useState('')
  const clobFeeRateQuery = useQuery({
    queryKey: ['docs-clob-fee-rate', clobUrl, tokenId],
    queryFn: () => fetchKuestFeeRate(tokenId, clobUrl),
    enabled: Boolean(clobUrl) && Boolean(tokenId),
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  })

  function handleTokenIdSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextTokenId = tokenIdInput.trim()
    if (!nextTokenId) {
      return
    }

    if (nextTokenId === tokenId) {
      void clobFeeRateQuery.refetch()
      return
    }

    setTokenId(nextTokenId)
  }

  if (isLoading) {
    return (
      <span className={className}>
        <span className="text-muted-foreground">Loading calculation example...</span>
      </span>
    )
  }

  if (data && !data.success) {
    if (format === 'inline') {
      return (
        <ErrorDisplay
          error={data.error}
          fallbackValue="Unable to load calculation example"
          className={className}
          showRefresh={true}
        />
      )
    }
    else {
      return (
        <ErrorDisplayBlock
          error={data.error}
          title="Unable to load fee calculation"
          className={className}
        />
      )
    }
  }

  if (!data?.success) {
    return null
  }

  const calculation = createFeeCalculationExample(
    amount,
    data.data,
    clobFeeRateQuery.data ?? null,
  )

  if (format === 'inline') {
    return (
      <span className={className}>
        For a $
        {calculation.tradeAmount}
        {' trade, the operator fee is $'}
        {calculation.operatorTakerFee}
        {' ('}
        {calculation.builderTakerFeePercent}
        %). Add the token-specific CLOB base fee to obtain the total trading fee.
      </span>
    )
  }

  return (
    <div className={className}>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-4">
          <h4 className="mb-3 font-semibold">Fee Calculation Example</h4>
          <form className="mb-4 space-y-2" onSubmit={handleTokenIdSubmit}>
            <label className="block text-sm font-medium" htmlFor={tokenIdInputId}>
              Outcome token ID
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={tokenIdInputId}
                type="text"
                value={tokenIdInput}
                onChange={event => setTokenIdInput(event.target.value)}
                placeholder="Paste a CLOB token ID"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                type="submit"
                disabled={!tokenIdInput.trim() || clobFeeRateQuery.isFetching}
                className="
                  rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                {clobFeeRateQuery.isFetching ? 'Loading...' : 'Load CLOB fee'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              The CLOB base fee is market-specific and is loaded from this deployment&apos;s configured CLOB URL.
            </p>
            {clobFeeRateQuery.isError && (
              <p className="text-sm text-destructive">
                Unable to load the CLOB fee for this token. Check the token ID and try again.
              </p>
            )}
          </form>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Filled Notional:</span>
              <span className="font-mono">
                $
                {calculation.tradeAmount}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                CLOB Base Fee
                {calculation.clobTakerFeePercent !== null && (
                  <>
                    {' ('}
                    {calculation.clobTakerFeePercent}
                    % /
                    {' '}
                    {calculation.clobTakerFeeBps}
                    {' '}
                    bps)
                  </>
                )}
                :
              </span>
              <span className="font-mono">
                {calculation.clobTakerFee === null
                  ? 'Enter token ID'
                  : `$${calculation.clobTakerFee}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                Operator Taker Fee (
                {calculation.builderTakerFeePercent}
                %):
              </span>
              <span className="font-mono">
                $
                {calculation.operatorTakerFee}
              </span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>
                Total Trading Fee
                {calculation.totalTakerFeePercent !== null && (
                  <>
                    {' ('}
                    {calculation.totalTakerFeePercent}
                    %)
                  </>
                )}
                :
              </span>
              <span className="font-mono">
                {calculation.totalTakerFee === null
                  ? 'Enter token ID'
                  : `$${calculation.totalTakerFee}`}
              </span>
            </div>
            <p className="pt-2 text-xs font-medium text-muted-foreground">
              Operator fee distribution
            </p>
            <div className="flex justify-between">
              <span>
                Affiliate Commission (
                {calculation.affiliateSharePercent}
                % of operator fee):
              </span>
              <span className="font-mono text-yes">
                $
                {calculation.affiliateCommission}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                Operator Share (
                {calculation.operatorSharePercent}
                % of operator fee):
              </span>
              <span className="font-mono text-blue-600">
                $
                {calculation.operatorShare}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
