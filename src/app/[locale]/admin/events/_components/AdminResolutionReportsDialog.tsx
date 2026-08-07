'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'
import Image from 'next/image'

import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import type { DirectResolutionOutcome } from '@/lib/direct-resolution'

import EventIconImage from '@/components/EventIconImage'
import ResolutionReporterHistoryBadges from '@/components/ResolutionReporterHistoryBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Link } from '@/i18n/navigation'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { formatTimeAgo, truncateAddress } from '@/lib/formatters'
import { resolveOutcomeButtonTheme } from '@/lib/outcome-theme'
import { buildPublicProfilePath } from '@/lib/platform-routing'

interface AdminResolutionReport {
  id: string
  conditionId: string
  marketTitle: string
  marketIconUrl: string
  outcome: DirectResolutionOutcome
  outcomeLabel: string
  reporterProfileSlug: string
  reporterUsername: string
  reporterImage: string
  historyCorrectCount: number
  historyIncorrectCount: number
  signedAt: string
}

interface AdminResolutionReportsDialogProps {
  event: AdminEventRow | null
  onClose: () => void
}

interface AdminResolutionReportPage {
  reports: AdminResolutionReport[]
  totalCount: number
  marketReportCounts: Record<string, number>
  nextOffset: number | null
}

async function fetchResolutionReports(eventId: string, offset: number): Promise<AdminResolutionReportPage> {
  const pathname = `/events/${encodeURIComponent(eventId)}/resolution-reports?offset=${offset}`
  let response = await fetch(`/admin/api${pathname}`, { cache: 'no-store' })
  if (response.status === 404 && typeof window !== 'undefined') {
    const [locale] = window.location.pathname.split('/').filter(Boolean)
    if (locale) {
      response = await fetch(`/${locale}/admin/api${pathname}`, { cache: 'no-store' })
    }
  }
  if (!response.ok) {
    throw new Error('Could not load resolution reports.')
  }
  const payload = (await response.json()) as Partial<AdminResolutionReportPage>
  return {
    reports: Array.isArray(payload.reports) ? payload.reports : [],
    totalCount: typeof payload.totalCount === 'number' ? payload.totalCount : 0,
    marketReportCounts:
      payload.marketReportCounts && typeof payload.marketReportCounts === 'object' ? payload.marketReportCounts : {},
    nextOffset: typeof payload.nextOffset === 'number' ? payload.nextOffset : null,
  }
}

function ReporterAvatar({ report }: { report: AdminResolutionReport }) {
  return shouldUseAvatarPlaceholder(report.reporterImage) ? (
    <span
      className="size-9 shrink-0 rounded-full border border-border"
      style={getAvatarPlaceholderStyle(report.id)}
      aria-hidden
    />
  ) : (
    <Image
      src={report.reporterImage}
      alt=""
      width={36}
      height={36}
      className="size-9 shrink-0 rounded-full border border-border object-cover"
    />
  )
}

export default function AdminResolutionReportsDialog({ event, onClose }: AdminResolutionReportsDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const reportsQuery = useInfiniteQuery({
    queryKey: ['admin-resolution-reports', event?.id],
    queryFn: ({ pageParam }) => fetchResolutionReports(event!.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: Boolean(event?.id),
    staleTime: 15_000,
  })
  const reports = reportsQuery.data?.pages.flatMap((page) => page.reports) ?? []
  const marketReportCounts = reportsQuery.data?.pages[0]?.marketReportCounts ?? {}
  const reportsByMarket = reports.reduce<Map<string, AdminResolutionReport[]>>((groups, report) => {
    const current = groups.get(report.conditionId) ?? []
    current.push(report)
    groups.set(report.conditionId, current)
    return groups
  }, new Map())

  const body = (
    <div className="grid min-h-36 gap-3 py-1">
      {reportsQuery.isLoading ? (
        <div className="grid min-h-32 place-items-center rounded-xl border bg-muted/10">
          <Spinner className="size-5" />
        </div>
      ) : reportsQuery.isError && reports.length === 0 ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {t('Could not load resolution reports.')}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border bg-muted/10 p-4 text-center text-sm text-muted-foreground">
          {t('No resolution reports found.')}
        </div>
      ) : (
        Array.from(reportsByMarket.entries()).map(([conditionId, marketReports]) => {
          const market = marketReports[0]!
          const iconUrl = event?.icon_url || market.marketIconUrl
          const eventTitle = event?.title || market.marketTitle
          return (
            <section key={conditionId} className="overflow-hidden rounded-xl border bg-background">
              <div className="flex min-w-0 items-center gap-3 border-b bg-muted/10 px-3 py-2.5">
                {iconUrl ? (
                  <EventIconImage
                    src={iconUrl}
                    alt={eventTitle}
                    sizes="36px"
                    containerClassName="size-9 shrink-0 rounded-md bg-muted"
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-sm font-semibold text-muted-foreground">
                    {eventTitle.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-snug font-semibold" title={eventTitle}>
                    {eventTitle}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={market.marketTitle}>
                    {market.marketTitle}
                  </p>
                </div>
                <Badge variant="secondary">{marketReportCounts[conditionId] ?? marketReports.length}</Badge>
              </div>

              <div className="divide-y">
                {marketReports.map((report) => {
                  const outcomeIndex = report.outcome === 'yes' ? 0 : report.outcome === 'no' ? 1 : null
                  const outcomeLabel = outcomeIndex === null ? t('Inconclusive result') : report.outcomeLabel
                  const theme = outcomeIndex === null ? null : resolveOutcomeButtonTheme(outcomeLabel, outcomeIndex)
                  const profileHref = buildPublicProfilePath(report.reporterProfileSlug)
                  return (
                    <div key={report.id} className="flex min-w-0 items-center gap-3 px-3 py-3">
                      {profileHref ? (
                        <Link
                          href={profileHref as any}
                          className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                          aria-label={`${report.reporterUsername || truncateAddress(report.reporterProfileSlug)} — ${t('Profile')}`}
                        >
                          <ReporterAvatar report={report} />
                        </Link>
                      ) : (
                        <ReporterAvatar report={report} />
                      )}
                      <div className="min-w-0 flex-1">
                        {profileHref ? (
                          <Link
                            href={profileHref as any}
                            className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {report.reporterUsername || truncateAddress(report.reporterProfileSlug)}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-medium">
                            {report.reporterUsername || truncateAddress(report.reporterProfileSlug)}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatTimeAgo(report.signedAt)}</span>
                          <ResolutionReporterHistoryBadges
                            correctCount={report.historyCorrectCount}
                            incorrectCount={report.historyIncorrectCount}
                            correctLabel={t('Correct')}
                            incorrectLabel={t('Incorrect')}
                            historyLabel={t('Proposal history: {correct} correct and {incorrect} incorrect.', {
                              correct: String(report.historyCorrectCount),
                              incorrect: String(report.historyIncorrectCount),
                            })}
                          />
                        </div>
                      </div>
                      <Badge
                        variant={outcomeIndex === null ? 'secondary' : 'outline'}
                        className="min-h-8 max-w-36 truncate rounded-md px-3 text-sm font-semibold"
                        style={theme ? { borderColor: theme.color, color: theme.color } : undefined}
                        title={outcomeLabel}
                      >
                        {outcomeLabel}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
      {reportsQuery.isFetchNextPageError && reports.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('Could not load resolution reports.')}
        </div>
      )}
      {reportsQuery.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void reportsQuery.fetchNextPage()}
          disabled={reportsQuery.isFetchingNextPage}
          className="w-full"
        >
          {reportsQuery.isFetchingNextPage ? (
            <Spinner className="size-4" />
          ) : reportsQuery.isFetchNextPageError ? (
            t('Try again')
          ) : (
            t('Load more')
          )}
        </Button>
      )}
    </div>
  )

  const footer = event ? (
    <Button nativeButton={false} render={<Link href={`/event/${event.slug}`}>{t('Open event')}</Link>} />
  ) : null

  if (isMobile) {
    return (
      <Drawer open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[92dvh] w-full overflow-y-auto bg-background px-4 pt-2 pb-6">
          <DrawerHeader className="gap-1 px-0 text-left">
            <DrawerTitle>{t('Resolution reports')}</DrawerTitle>
            <DrawerDescription>{t('Review user proposals before resolving the event.')}</DrawerDescription>
          </DrawerHeader>
          {body}
          <DrawerFooter className="mt-4 border-t border-border/50 px-0 pt-4 pb-0">{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] min-w-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Resolution reports')}</DialogTitle>
          <DialogDescription>{t('Review user proposals before resolving the event.')}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="border-t border-border/50 pt-4">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
