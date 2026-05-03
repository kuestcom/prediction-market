'use client'

import { useAffiliateData } from '@/hooks/useAffiliateData'
import { createFeeCalculationExample } from '@/lib/affiliate-data'
import { ErrorDisplay, ErrorDisplayBlock } from './ErrorDisplay'

interface FeeCalculationExampleProps {
  amount: number
  className?: string
  format?: 'table' | 'inline'
}

export function FeeCalculationExample({ amount, className = '', format = 'table' }: FeeCalculationExampleProps) {
  const { data, isLoading } = useAffiliateData()

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

  const calculation = createFeeCalculationExample(amount, data.data)

  if (format === 'inline') {
    return (
      <span className={className}>
        For a $
        {calculation.tradeAmount}
        {' '}
        trade: $
        {calculation.operatorTakerFee}
        {' '}
        operator taker fee (
        {calculation.builderTakerFeePercent}
        %),
        $
        {calculation.affiliateCommission}
        {' '}
        affiliate commission (
        {calculation.affiliateSharePercent}
        %),
        $
        {calculation.operatorShare}
        {' '}
        operator share (
        {calculation.operatorSharePercent}
        %)
      </span>
    )
  }

  return (
    <div className={className}>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-4">
          <h4 className="mb-3 font-semibold">Fee Calculation Example</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Trade Amount:</span>
              <span className="font-mono">
                $
                {calculation.tradeAmount}
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
            <div className="flex justify-between">
              <span>
                Affiliate Commission (
                {calculation.affiliateSharePercent}
                %):
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
                %):
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
