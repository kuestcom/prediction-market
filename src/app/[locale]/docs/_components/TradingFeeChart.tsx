'use client'

import { useExtracted } from 'next-intl'

import AdminAffiliateFeeChart from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateFeeChart'
import { ErrorDisplayBlock } from '@/app/[locale]/docs/_components/ErrorDisplay'
import { useAffiliateData } from '@/hooks/useAffiliateData'

export function TradingFeeChart() {
  const t = useExtracted()
  const { data, isLoading } = useAffiliateData()

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-lg border bg-muted/30" aria-label={t('Loading fee chart')} />
  }

  if (data && !data.success) {
    return <ErrorDisplayBlock error={data.error} title={t('Unable to load the fee chart')} />
  }

  if (!data?.success) {
    return null
  }

  return (
    <AdminAffiliateFeeChart
      operatorSharePercent={data.data.builderTakerShareDecimal * 100}
      siteName=""
      audience="trader"
    />
  )
}
