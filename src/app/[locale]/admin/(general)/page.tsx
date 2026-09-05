import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'

import {
  ChartNoAxesCombinedIcon,
  GavelIcon,
  HandCoinsIcon,
  MessageSquareWarningIcon,
  UsersIcon,
  VolleyballIcon,
} from 'lucide-react'
import { getExtracted } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'

import AdminDashboardSparkline from '@/app/[locale]/admin/_components/AdminDashboardSparkline'
import { Link } from '@/i18n/navigation'
import { fetchBuilderVolume } from '@/lib/clob-builder-volume'
import { DEFAULT_FEE_RECEIVER_WALLET_ADDRESS } from '@/lib/contracts'
import {
  baseUnitsToNumber,
  combineAvailableDailyFeeSeries,
  fetchFeeHistoryTimeSeries,
  fetchFeeHistoryTotal,
} from '@/lib/data-api/fees'
import { AdminDashboardRepository } from '@/lib/db/queries/admin-dashboard'
import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { formatCompactCount, formatCompactCurrency } from '@/lib/formatters'
import {
  countResolutionReportsByCondition,
  fetchAllowedCreatorResolutionReports,
} from '@/lib/resolution-reports-server'
import { getFeeRecipientWalletFormValue } from '@/lib/theme-settings'
import { cn } from '@/lib/utils'

export const instant = false

interface MetricCardProps {
  className?: string
  description: string
  href: Route
  highlightIcon?: boolean
  icon: LucideIcon
  label: string
  value: string
}

function MetricCard({ className, description, highlightIcon, href, icon: Icon, label, value }: MetricCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-44 flex-col rounded-xl border bg-background p-5 transition-colors hover:border-foreground/20',
        className,
      )}
    >
      <div
        className={cn(
          'grid size-10 place-items-center rounded-lg border bg-muted/35 text-muted-foreground',
          highlightIcon && 'text-primary',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="mt-auto pt-6">
        <p className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{value}</p>
        <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}

interface ChartMetricCardProps extends MetricCardProps {
  chartAriaLabel: string
  chartClassName?: string
  chartFormat: 'count' | 'currency'
  points: Array<{ date: string; value: number }>
}

function ChartMetricCard({
  chartAriaLabel,
  chartClassName,
  chartFormat,
  className,
  description,
  href,
  icon: Icon,
  label,
  points,
  value,
}: ChartMetricCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        `group relative flex min-h-44 flex-col overflow-hidden rounded-xl border bg-background p-5 transition-colors hover:border-foreground/20`,
        className,
      )}
    >
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-5">
        <div>
          <div className="grid size-10 place-items-center rounded-lg border bg-muted/35 text-muted-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{value}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className={cn('absolute inset-y-3 right-4 left-[44%] sm:left-[40%]', chartClassName)}>
        <AdminDashboardSparkline ariaLabel={chartAriaLabel} className="h-full" format={chartFormat} points={points} />
      </div>
    </Link>
  )
}

function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('min-h-44 animate-pulse rounded-xl border bg-background p-5', className)}>
      <div className="size-10 rounded-lg bg-muted" />
      <div className="mt-10 h-9 w-24 rounded-md bg-muted" />
      <div className="mt-3 h-4 w-36 rounded-sm bg-muted" />
      <div className="mt-2 h-3 w-28 rounded-sm bg-muted" />
    </div>
  )
}

function DashboardCardsFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <DashboardCardSkeleton className="xl:col-span-2" />
      <DashboardCardSkeleton className="xl:col-span-2" />
      <DashboardCardSkeleton className="xl:col-span-2" />
      <DashboardCardSkeleton className="xl:col-span-3" />
      <DashboardCardSkeleton className="xl:col-span-3" />
      <DashboardCardSkeleton className="sm:col-span-2 xl:col-span-6" />
    </div>
  )
}

async function AdminDashboardCards() {
  await io()

  const t = await getExtracted()
  const [metricsResult, settingsResult] = await Promise.all([
    AdminDashboardRepository.getMetrics(),
    SettingsRepository.getSettings(),
  ])
  let resolutionReportCount: number | undefined
  try {
    const resolutionReports = await fetchAllowedCreatorResolutionReports()
    resolutionReportCount = await ResolutionReportContextRepository.countActiveReports(
      countResolutionReportsByCondition(resolutionReports),
    )
  } catch (error) {
    console.warn('Could not load the resolution report dashboard metric.', error)
  }
  const metrics = metricsResult.data ? { ...metricsResult.data, resolutionReportCount } : metricsResult.data
  const feeRecipientWallet =
    getFeeRecipientWalletFormValue(settingsResult.data ?? undefined) || DEFAULT_FEE_RECEIVER_WALLET_ADDRESS
  const feeHistoryResults = await Promise.allSettled([
    fetchFeeHistoryTotal(feeRecipientWallet, 'BUILDER'),
    fetchFeeHistoryTotal(feeRecipientWallet, 'AFFILIATE'),
    fetchFeeHistoryTimeSeries(feeRecipientWallet, 'BUILDER'),
    fetchFeeHistoryTimeSeries(feeRecipientWallet, 'AFFILIATE'),
    fetchBuilderVolume(feeRecipientWallet),
  ])
  const [builderTotal, affiliateTotal, builderSeries, affiliateSeries, builderVolumeResult] = feeHistoryResults
  let totalFees: number | null = null
  if (builderTotal.status === 'fulfilled' && affiliateTotal.status === 'fulfilled') {
    try {
      totalFees = baseUnitsToNumber(
        BigInt(builderTotal.value.totalAmount) + BigInt(affiliateTotal.value.totalAmount),
        6,
      )
    } catch (error) {
      console.warn('Could not parse the Data API fee history totals.', error)
    }
  }
  const feeSeries = combineAvailableDailyFeeSeries([builderSeries, affiliateSeries])
  const builderVolume = builderVolumeResult.status === 'fulfilled' ? builderVolumeResult.value : null
  if (builderVolumeResult.status === 'rejected') {
    console.warn('Could not load the CLOB builder volume.', builderVolumeResult.reason)
  }

  function formatCount(value: number | undefined) {
    return value == null ? '—' : formatCompactCount(value)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard
        className="xl:col-span-2"
        href={'/admin/events?attention=missing-sports-id' as Route}
        highlightIcon={(metrics?.missingSportsSourceCount ?? 0) > 0}
        icon={VolleyballIcon}
        value={formatCount(metrics?.missingSportsSourceCount)}
        label={t('Events without a sports ID')}
        description={t('Active sports and esports events')}
      />
      <MetricCard
        className="xl:col-span-2"
        href={'/admin/events?attention=past-due-unresolved' as Route}
        highlightIcon={(metrics?.pendingResolutionCount ?? 0) > 0}
        icon={GavelIcon}
        value={formatCount(metrics?.pendingResolutionCount)}
        label={t('Events awaiting resolution')}
        description={t('Past their end time')}
      />
      <MetricCard
        className="xl:col-span-2"
        href={'/admin/events?attention=resolution-reports' as Route}
        highlightIcon={(metrics?.resolutionReportCount ?? 0) > 0}
        icon={MessageSquareWarningIcon}
        value={formatCount(metrics?.resolutionReportCount)}
        label={t('Resolution reports')}
        description={t('User proposals awaiting review')}
      />
      <ChartMetricCard
        className="xl:col-span-3"
        href={'/admin/users' as Route}
        icon={UsersIcon}
        value={formatCount(metrics?.registeredUsersCount)}
        label={t('Registered users')}
        description={
          metrics
            ? t('{count} in the last 7 days', { count: formatCompactCount(metrics.registeredUsersLastSevenDaysCount) })
            : '—'
        }
        chartAriaLabel={t('User growth over the last 30 days')}
        chartFormat="count"
        points={metrics?.registeredUsersSeries ?? []}
      />
      <ChartMetricCard
        className="xl:col-span-3"
        href={'/admin/affiliate' as Route}
        icon={HandCoinsIcon}
        value={totalFees == null ? '—' : formatCompactCurrency(totalFees)}
        label={t('Fee history')}
        description={t('Total fees received')}
        chartAriaLabel={t('Daily fees over the last 30 days')}
        chartFormat="currency"
        points={feeSeries}
      />
      <ChartMetricCard
        className="sm:col-span-2 xl:col-span-6"
        chartClassName="sm:left-[28%]"
        href={'/admin/events' as Route}
        icon={ChartNoAxesCombinedIcon}
        value={builderVolume ? formatCompactCurrency(builderVolume.total) : '—'}
        label={t('Trading volume')}
        description={t('All-time traded value')}
        chartAriaLabel={t('Daily trading volume over the last 30 days')}
        chartFormat="currency"
        points={builderVolume?.daily ?? []}
      />
    </div>
  )
}

export default async function AdminDashboardPage() {
  const t = await getExtracted()

  return (
    <section className="grid min-w-0 gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Dashboard')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('A quick view of what needs attention and the platform totals.')}
        </p>
      </div>

      <Suspense fallback={<DashboardCardsFallback />}>
        <AdminDashboardCards />
      </Suspense>
    </section>
  )
}
