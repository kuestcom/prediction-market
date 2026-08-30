export interface SeriesQuoteInputParams {
  sponsor: string
  importId?: string | null
  marketSource: 'kuest' | 'polymarket'
  conditionIds: string[]
  depthPerSideAtomic: string
  maxSpreadBps: number
  sponsorPremiumBps?: number
  serviceEnd?: number
  sponsorSeries: boolean
  seriesSlug?: string | null
  creatorFilter?: string | null
}

export function marketImportStorageKey(params: {
  chainId: number
  wallet: string
  eventSlug: string
  sponsorSeries: boolean
}) {
  const legacyEventKey = `kuest-market-import:${params.chainId}:${params.wallet.toLowerCase()}:${params.eventSlug}`
  return params.sponsorSeries ? `${legacyEventKey}:series` : legacyEventKey
}

export function buildMarketMakerQuoteInput(params: SeriesQuoteInputParams): Record<string, unknown> {
  const input: Record<string, unknown> = {
    sponsor: params.sponsor,
    ...(params.importId ? { importId: params.importId } : {}),
    marketSource: params.marketSource,
    conditionIds: params.conditionIds,
    depthPerSideAtomic: params.depthPerSideAtomic,
    maxSpreadBps: params.maxSpreadBps,
    sponsorPremiumBps: params.sponsorPremiumBps ?? 0,
  }
  if (!params.sponsorSeries && params.serviceEnd !== undefined) {
    input.serviceEnd = params.serviceEnd
  }
  if (params.sponsorSeries && params.seriesSlug && params.creatorFilter) {
    input.series = {
      enabled: true,
      seriesSlug: params.seriesSlug,
      creatorFilter: params.creatorFilter,
    }
  }
  return input
}

export interface EscrowCostBreakdownLike {
  status: 'estimate' | 'partial' | 'final'
  campaignFundingTotalAtomic: string | null
  initialDeploymentFeeAtomic: string | null
  totalCostAtomic: string | null
  initialDeploymentFeePaid: boolean
  initialDeploymentFeeStatus: 'estimate' | 'final'
  campaignFundingStatus: 'pending' | 'final'
  totalCostStatus: 'pending' | 'estimate' | 'final'
}

export function displayedCostAtomic(costs: EscrowCostBreakdownLike): string | null {
  return costs.initialDeploymentFeePaid ? costs.campaignFundingTotalAtomic : costs.totalCostAtomic
}

export function sponsorshipDurationSubtitle(params: {
  sponsorSeries: boolean
  allRenewals: string
  dateLabel: string
}) {
  return params.sponsorSeries ? params.allRenewals : params.dateLabel
}

export function requiredSponsorBalanceAtomic(
  costs: EscrowCostBreakdownLike,
  deploymentPaymentPending: boolean,
): bigint | null {
  if (costs.campaignFundingTotalAtomic === null) {
    return null
  }
  const deployment = deploymentPaymentPending ? BigInt(costs.initialDeploymentFeeAtomic ?? '0') : 0n
  return BigInt(costs.campaignFundingTotalAtomic) + deployment
}

export function seriesMarketDataSummary(campaign: {
  scopeKind: 'event' | 'series'
  seriesSlug: string | null
  links: {
    campaignApi: string
    seriesEventsApi?: string
    anchorMarketApis?: Array<{ conditionId: string; url: string }>
  }
}) {
  return {
    isSeries: campaign.scopeKind === 'series' && campaign.seriesSlug !== null,
    durationDays: 30,
    links: [
      campaign.links.campaignApi,
      ...(campaign.links.seriesEventsApi ? [campaign.links.seriesEventsApi] : []),
      ...(campaign.links.anchorMarketApis ?? []).map((link) => link.url),
    ],
  }
}
