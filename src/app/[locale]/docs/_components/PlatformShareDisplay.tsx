'use client'

import { useAffiliateData } from '@/hooks/useAffiliateData'
import { ErrorDisplay } from './ErrorDisplay'

interface PlatformShareDisplayProps {
  showSymbol?: boolean
  className?: string
}

export function PlatformShareDisplay({
  showSymbol = true,
  className = 'font-semibold text-primary',
}: PlatformShareDisplayProps) {
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

  const operatorSharePercent = data?.success
    ? data.data.operatorSharePercent
    : 'N/A'

  return (
    <span className={className}>
      {operatorSharePercent}
      {showSymbol ? '%' : ''}
    </span>
  )
}
