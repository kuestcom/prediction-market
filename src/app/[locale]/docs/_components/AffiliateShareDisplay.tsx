'use client'

import { useAffiliateData } from '@/hooks/useAffiliateData'

import { ErrorDisplay } from './ErrorDisplay'

interface AffiliateShareDisplayProps {
  showSymbol?: boolean
  className?: string
}

export function AffiliateShareDisplay({
  showSymbol = true,
  className = 'font-semibold text-primary',
}: AffiliateShareDisplayProps) {
  const { data, isLoading } = useAffiliateData()

  if (isLoading) {
    return <span className={className}>Loading...</span>
  }

  if (data && !data.success) {
    return <ErrorDisplay error={data.error} className={className} showRefresh={true} />
  }

  const affiliateSharePercent = data?.success ? data.data.affiliateSharePercent : 'N/A'

  return (
    <span className={className}>
      {affiliateSharePercent}
      {showSymbol ? '%' : ''}
    </span>
  )
}
