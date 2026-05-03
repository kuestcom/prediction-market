'use client'

import { useAffiliateData } from '@/hooks/useAffiliateData'
import { ErrorDisplay } from './ErrorDisplay'

interface TradingFeeDisplayProps {
  showSymbol?: boolean
  className?: string
}

export function TradingFeeDisplay({
  showSymbol = true,
  className = 'font-semibold text-primary',
}: TradingFeeDisplayProps) {
  const { data, isLoading } = useAffiliateData()

  if (isLoading) {
    return (
      <span className={className}>
        Loading...
      </span>
    )
  }

  if (data && !data.success) {
    return (
      <ErrorDisplay
        error={data.error}
        className={className}
        showRefresh={true}
      />
    )
  }

  const builderTakerFeePercent = data?.success
    ? data.data.builderTakerFeePercent
    : 'N/A'

  return (
    <span className={className}>
      {builderTakerFeePercent}
      {showSymbol ? '%' : ''}
    </span>
  )
}
