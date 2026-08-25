import { keccak256, parseAbi, stringToHex } from 'viem'

export const MARKET_MAKER_ESCROW_ABI = parseAbi([
  'struct Campaign { address sponsor; address marketMaker; address payoutAccount; uint256 reward; uint256 protocolFee; uint256 bond; bytes32 quoteId; bytes32 scopeHash; bytes32 termsHash; bytes32 evidenceHash; bytes32 decisionHash; uint64 acceptDeadline; uint64 serviceStart; uint64 serviceEnd; uint64 claimableAt; uint64 disputedAt; uint16 protocolFeeBps; uint8 status; uint256 rewardToMaker; uint256 bondToSponsor; }',
  'function campaignCount() view returns (uint256)',
  'function getCampaign(uint256 campaignId) view returns (Campaign)',
  'function pendingWithdrawals(address account) view returns (uint256)',
  'function createCampaign((bytes32 quoteId,address sponsor,bytes32 scopeHash,bytes32 termsHash,uint256 reward,uint256 bond,uint16 protocolFeeBps,uint64 acceptDeadline,uint64 serviceStart,uint64 serviceEnd,uint64 claimableAt,uint64 validUntil) quote, bytes operatorSignature) returns (uint256 campaignId)',
  'function cancelCampaign(uint256 campaignId)',
  'function openDispute(uint256 campaignId, bytes32 evidenceHash)',
  'function withdraw()',
  'event CampaignAccepted(uint256 indexed campaignId, address indexed marketMaker, address indexed payoutAccount, uint256 bond)',
])

export const ESCROW_CAMPAIGN_STATUS = {
  none: 0,
  open: 1,
  active: 2,
  review: 3,
  disputed: 4,
  paid: 5,
  resolved: 6,
  cancelled: 7,
} as const

const MARKET_MAKER_RESOLUTION_DECISIONS = [
  'Liquidity was unavailable for a material part of the service period.',
  'Liquidity availability remained within the agreed requirement.',
  'The spread exceeded the agreed maximum for a material part of the service period.',
  'The spread remained within the agreed maximum.',
  'Buy or sell depth remained below the agreed amount for a material part of the service period.',
  'Buy and sell depth remained within the agreed requirement.',
  'The market maker stopped providing liquidity before the service period ended.',
  'Liquidity was provided throughout the required service period.',
  'The evidence shows a material breach of the agreed terms.',
  'The dispute did not include convincing evidence of a material breach.',
  'The service was provided for only part of the agreed period; payment was allocated proportionally.',
  'The service was partially compliant; payment was reduced to reflect the measured shortfall.',
  'Custom decision',
] as const

/** Stable identifiers for the canonical English decision phrases. */
const MARKET_MAKER_RESOLUTION_DECISION_CODES = [
  ['liquidity_unavailable_upheld', MARKET_MAKER_RESOLUTION_DECISIONS[0]],
  ['liquidity_unavailable_rejected', MARKET_MAKER_RESOLUTION_DECISIONS[1]],
  ['spread_exceeded_upheld', MARKET_MAKER_RESOLUTION_DECISIONS[2]],
  ['spread_exceeded_rejected', MARKET_MAKER_RESOLUTION_DECISIONS[3]],
  ['depth_too_low_upheld', MARKET_MAKER_RESOLUTION_DECISIONS[4]],
  ['depth_too_low_rejected', MARKET_MAKER_RESOLUTION_DECISIONS[5]],
  ['maker_stopped_upheld', MARKET_MAKER_RESOLUTION_DECISIONS[6]],
  ['maker_stopped_rejected', MARKET_MAKER_RESOLUTION_DECISIONS[7]],
  ['material_breach_upheld', MARKET_MAKER_RESOLUTION_DECISIONS[8]],
  ['insufficient_evidence', MARKET_MAKER_RESOLUTION_DECISIONS[9]],
  ['partial_period', MARKET_MAKER_RESOLUTION_DECISIONS[10]],
  ['partial_compliance', MARKET_MAKER_RESOLUTION_DECISIONS[11]],
  ['custom', MARKET_MAKER_RESOLUTION_DECISIONS[12]],
] as const

export function resolutionDecisionForHash(decisionHash: string | null | undefined) {
  if (!decisionHash) {
    return null
  }
  return (
    MARKET_MAKER_RESOLUTION_DECISIONS.find(
      (text) => keccak256(stringToHex(text)).toLowerCase() === decisionHash.toLowerCase(),
    ) ?? null
  )
}

export function resolutionDecisionCodeForHash(decisionHash: string | null | undefined) {
  const text = resolutionDecisionForHash(decisionHash)
  return text === null
    ? null
    : (MARKET_MAKER_RESOLUTION_DECISION_CODES.find(([, canonical]) => canonical === text)?.[0] ?? null)
}

export type EscrowCampaignStatusFilter = 'all' | 'open' | 'active' | 'review' | 'disputed' | 'completed' | 'cancelled'

export type EscrowTermsValue =
  | null
  | boolean
  | number
  | string
  | EscrowTermsValue[]
  | { [key: string]: EscrowTermsValue }

export interface MarketMakingCampaignRecord {
  id: string
  sponsor: `0x${string}`
  marketMaker: `0x${string}`
  payoutAccount: `0x${string}`
  rewardAtomic: string
  protocolFeeAtomic: string
  bondAtomic: string
  quoteId: `0x${string}`
  scopeHash: `0x${string}`
  termsHash: `0x${string}`
  evidenceHash: `0x${string}`
  decisionHash: `0x${string}`
  acceptDeadline: number
  serviceStart: number
  serviceEnd: number
  claimableAt: number
  disputedAt: number
  protocolFeeBps: number
  status: number
  rewardToMakerAtomic: string
  bondToSponsorAtomic: string
  refundableAtomic: string
  createdAt: number | null
  acceptedAt: number | null
  reviewStartedAt: number | null
  cancelledAt: number | null
  completedAt: number | null
  title: string
  iconUrl: string | null
  eventSlug: string | null
  marketCount: number
  marketSource: 'kuest' | 'polymarket' | null
  depthPerSideAtomic: string | null
  maxSpreadBps: number | null
  availabilityBps: number | null
  terms: EscrowTermsValue
  markets: Array<{
    conditionId: string
    title: string | null
  }>
  scopeKind: 'event' | 'series'
  seriesSlug: string | null
  seriesRecurrence: string | null
  creatorFilter: string | null
  anchorEventSlug: string | null
  seriesLeaseStatus: string | null
  seriesLeaseEffectiveEnd: number | null
  links: {
    campaignApi: string
    seriesEventsApi?: string
    anchorMarketApi?: string | null
    anchorMarketApis?: Array<{ conditionId: string; url: string }>
  }
}

export interface MarketMakingCampaignsResponse {
  data: MarketMakingCampaignRecord[]
}

export function getEffectiveCampaignStatus(status: number, serviceEnd: number, nowSeconds: number) {
  if (status === ESCROW_CAMPAIGN_STATUS.active && nowSeconds >= serviceEnd) {
    return ESCROW_CAMPAIGN_STATUS.review
  }
  return status
}
