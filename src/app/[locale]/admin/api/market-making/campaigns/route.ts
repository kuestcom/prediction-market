import { eq, inArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

import type {
  EscrowTermsValue,
  MarketMakingCampaignRecord,
  MarketMakingCampaignsResponse,
} from '@/lib/market-maker-escrow'

import { ZERO_ADDRESS } from '@/lib/contracts'
import { UserRepository } from '@/lib/db/queries/user'
import { events, markets } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { getPublicAssetUrl } from '@/lib/storage'

const ZERO_HASH = `0x${'0'.repeat(64)}` as `0x${string}`

interface IndexedTerms {
  coverage?: { minimumBps?: number; minimumTwoSidedBps?: number }
  depth?: { bands?: Array<{ minimumUsdcAtomic?: string }> }
  spread?: { maximumBps?: number }
}

interface IndexedMarketMetadata {
  eventTitle?: string
  icon?: string
  iconUrl?: string
  image?: string
  slug?: string
  title?: string
}

interface IndexedCampaign {
  acceptDeadline: number
  acceptedAt?: number | null
  bondAtomic: string
  bondToSponsorAtomic: string
  cancelledAt?: number | null
  claimableAt: number
  completedAt?: number | null
  createdAt: number
  decisionHash?: string | null
  disputedAt?: number | null
  eventImageUrl?: string | null
  eventTitle?: string | null
  evidenceHash?: string | null
  id: string
  marketCount: number
  marketMaker: string
  marketSource: 'kuest' | 'polymarket'
  markets: Array<{
    conditionId: string
    metadata?: IndexedMarketMetadata | null
  }>
  payoutAccount: string
  protocolFeeAtomic: string
  protocolFeeBps: number
  quoteId: string
  reviewStartedAt?: number | null
  rewardAtomic: string
  refundableAtomic?: string
  rewardToMakerAtomic: string
  scopeHash: string
  serviceEnd: number
  serviceStart: number
  sponsor: string
  statusCode: number
  terms?: EscrowTermsValue
  termsHash: string
  scopeKind?: 'event' | 'series'
  seriesSlug?: string | null
  seriesRecurrence?: string | null
  creatorFilter?: string | null
  anchorEventSlug?: string | null
  seriesLeaseStatus?: string | null
  seriesLeaseEffectiveEnd?: number | null
  links?: MarketMakingCampaignRecord['links']
}

interface IndexedCampaignsResponse {
  data?: IndexedCampaign[]
}

async function fetchIndexedCampaigns(url: string): Promise<IndexedCampaignsResponse | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    return response.ok ? ((await response.json()) as IndexedCampaignsResponse) : null
  } catch {
    return null
  }
}

async function fetchIndexedCampaign(url: string): Promise<IndexedCampaign | null | 'error'> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      return 'error'
    }
    return (await response.json()) as IndexedCampaign
  } catch {
    return 'error'
  }
}

function resolveImageUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized
  }
  return getPublicAssetUrl(normalized) || null
}

function asAddress(value: string) {
  return (isAddress(value) ? value : ZERO_ADDRESS) as `0x${string}`
}

function asHash(value: string | null | undefined) {
  return (/^0x[0-9a-f]{64}$/i.test(value ?? '') ? value : ZERO_HASH) as `0x${string}`
}

function asTimestamp(value: number | null | undefined) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0
}

function indexedTerms(value: EscrowTermsValue | undefined) {
  return (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as IndexedTerms
}

export async function GET(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }
    if (!isAddress(currentUser.address)) {
      return NextResponse.json({ data: [] } satisfies MarketMakingCampaignsResponse)
    }

    const { escrowUrl } = resolvePublicRuntimeEnv(process.env)
    const escrowBaseUrl = escrowUrl.replace(/\/+$/, '')
    const campaignId = new URL(request.url).searchParams.get('campaign')
    let indexedCampaigns: IndexedCampaign[]
    if (campaignId !== null) {
      if (!/^(0|[1-9][0-9]*)$/.test(campaignId)) {
        return NextResponse.json({ error: 'Campaign ID is invalid.' }, { status: 400 })
      }
      const indexedCampaign = await fetchIndexedCampaign(
        `${escrowBaseUrl}/api/campaigns/${encodeURIComponent(campaignId)}`,
      )
      if (indexedCampaign === 'error') {
        return NextResponse.json({ error: 'Campaign index is unavailable.' }, { status: 502 })
      }
      if (!indexedCampaign || indexedCampaign.sponsor.toLowerCase() !== currentUser.address.toLowerCase()) {
        return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
      }
      indexedCampaigns = [indexedCampaign]
    } else {
      const indexedResponse = await fetchIndexedCampaigns(
        `${escrowBaseUrl}/api/campaigns?sponsor=${encodeURIComponent(currentUser.address)}&limit=100`,
      )
      if (!indexedResponse) {
        return NextResponse.json({ error: 'Campaign index is unavailable.' }, { status: 502 })
      }
      indexedCampaigns = indexedResponse.data ?? []
    }
    const conditionIds = [
      ...new Set(
        indexedCampaigns.flatMap((campaign) => campaign.markets.map((market) => market.conditionId.toLowerCase())),
      ),
    ].filter(Boolean)
    const eventByCondition = new Map<
      string,
      { title: string; iconUrl: string | null; slug: string; marketTitle: string | null }
    >()

    if (conditionIds.length > 0) {
      const eventRows = await db
        .select({
          conditionId: markets.condition_id,
          eventTitle: events.title,
          eventIconUrl: events.icon_url,
          eventSlug: events.slug,
          marketTitle: markets.title,
        })
        .from(markets)
        .innerJoin(events, eq(markets.event_id, events.id))
        .where(inArray(sql<string>`LOWER(${markets.condition_id})`, conditionIds))
      for (const row of eventRows) {
        eventByCondition.set(row.conditionId.toLowerCase(), {
          title: row.eventTitle,
          iconUrl: resolveImageUrl(row.eventIconUrl),
          slug: row.eventSlug,
          marketTitle: row.marketTitle,
        })
      }
    }

    const data = indexedCampaigns.map((campaign) => {
      const terms = indexedTerms(campaign.terms)
      const localEvents = campaign.markets.flatMap((market) => {
        const event = eventByCondition.get(market.conditionId.toLowerCase())
        return event ? [event] : []
      })
      const localTitles = new Set(localEvents.map((event) => event.title))
      const firstMetadata = campaign.markets[0]?.metadata
      const title =
        (localTitles.size === 1 ? [...localTitles][0] : null) ??
        campaign.eventTitle ??
        firstMetadata?.eventTitle ??
        firstMetadata?.title ??
        `Campaign #${campaign.id}`
      const iconUrl =
        localEvents.find((event) => event.iconUrl)?.iconUrl ??
        resolveImageUrl(campaign.eventImageUrl) ??
        resolveImageUrl(firstMetadata?.iconUrl ?? firstMetadata?.icon ?? firstMetadata?.image)
      const eventSlug = localEvents[0]?.slug ?? firstMetadata?.slug ?? null

      return {
        id: campaign.id,
        sponsor: asAddress(campaign.sponsor),
        marketMaker: asAddress(campaign.marketMaker),
        payoutAccount: asAddress(campaign.payoutAccount),
        rewardAtomic: campaign.rewardAtomic,
        protocolFeeAtomic: campaign.protocolFeeAtomic,
        bondAtomic: campaign.bondAtomic,
        quoteId: asHash(campaign.quoteId),
        scopeHash: asHash(campaign.scopeHash),
        termsHash: asHash(campaign.termsHash),
        evidenceHash: asHash(campaign.evidenceHash),
        decisionHash: asHash(campaign.decisionHash),
        acceptDeadline: asTimestamp(campaign.acceptDeadline),
        serviceStart: asTimestamp(campaign.serviceStart),
        serviceEnd: asTimestamp(campaign.serviceEnd),
        claimableAt: asTimestamp(campaign.claimableAt),
        disputedAt: asTimestamp(campaign.disputedAt),
        protocolFeeBps: campaign.protocolFeeBps,
        status: campaign.statusCode,
        rewardToMakerAtomic: campaign.rewardToMakerAtomic,
        bondToSponsorAtomic: campaign.bondToSponsorAtomic,
        refundableAtomic: campaign.refundableAtomic ?? '0',
        createdAt: asTimestamp(campaign.createdAt),
        acceptedAt: campaign.acceptedAt ?? null,
        reviewStartedAt: campaign.reviewStartedAt ?? null,
        cancelledAt: campaign.cancelledAt ?? null,
        completedAt: campaign.completedAt ?? null,
        title,
        iconUrl,
        eventSlug,
        marketCount: campaign.marketCount,
        marketSource: campaign.marketSource,
        depthPerSideAtomic: terms.depth?.bands?.[0]?.minimumUsdcAtomic ?? null,
        maxSpreadBps: terms.spread?.maximumBps ?? null,
        availabilityBps: terms.coverage?.minimumBps ?? terms.coverage?.minimumTwoSidedBps ?? null,
        terms: campaign.terms ?? null,
        markets: campaign.markets.map((market) => ({
          conditionId: market.conditionId,
          title: eventByCondition.get(market.conditionId.toLowerCase())?.marketTitle ?? market.metadata?.title ?? null,
        })),
        scopeKind: campaign.scopeKind === 'series' ? 'series' : 'event',
        seriesSlug: campaign.seriesSlug ?? null,
        seriesRecurrence: campaign.seriesRecurrence ?? null,
        creatorFilter: campaign.creatorFilter ?? null,
        anchorEventSlug: campaign.anchorEventSlug ?? null,
        seriesLeaseStatus: campaign.seriesLeaseStatus ?? null,
        seriesLeaseEffectiveEnd: campaign.seriesLeaseEffectiveEnd ?? null,
        links: campaign.links ?? { campaignApi: `${escrowBaseUrl}/api/campaigns/${encodeURIComponent(campaign.id)}` },
      } satisfies MarketMakingCampaignRecord
    })

    return NextResponse.json({ data } satisfies MarketMakingCampaignsResponse)
  } catch (error) {
    console.error('Market-making campaigns API error:', error)
    return NextResponse.json({ error: 'Could not load campaigns.' }, { status: 500 })
  }
}
