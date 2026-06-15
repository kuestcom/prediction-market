import type { Address, Hex } from 'viem'
import type { Event } from '@/types'
import { isAddress, stringToHex } from 'viem'
import {
  DIRECT_RESOLUTION_ORACLE_ADDRESS,
  DRO_CTF_ADAPTER_V4_ADDRESS,
  NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS,
  NEGRISK_OPERATOR_DRO_ADDRESS,
} from '@/lib/contracts'
import { isGasFeeTooLowError } from '@/lib/transaction-fees'
import { normalizeAddress } from '@/lib/wallet'

export type ResolutionType = 'dro_moov2' | 'uma_moov2' | 'legacy'
export type DirectResolutionOutcome = 'yes' | 'no' | 'unknown'

export const YES_OR_NO_IDENTIFIER = stringToHex('YES_OR_NO_QUERY', { size: 32 }) as Hex

export const CTF_ADAPTER_QUESTION_ABI = [
  {
    type: 'function',
    name: 'getQuestion',
    stateMutability: 'view',
    inputs: [{ name: 'questionID', type: 'bytes32' }],
    outputs: [
      {
        name: 'question',
        type: 'tuple',
        components: [
          { name: 'requestTimestamp', type: 'uint256' },
          { name: 'reward', type: 'uint256' },
          { name: 'proposalBond', type: 'uint256' },
          { name: 'liveness', type: 'uint256' },
          { name: 'manualResolutionTimestamp', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'paused', type: 'bool' },
          { name: 'reset', type: 'bool' },
          { name: 'refund', type: 'bool' },
          { name: 'rewardToken', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'ancillaryData', type: 'bytes' },
        ],
      },
    ],
  },
] as const

export const DIRECT_RESOLUTION_ORACLE_ABI = [
  {
    type: 'function',
    name: 'proposeAndResolve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'questionId', type: 'bytes32' },
      { name: 'identifier', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'ancillaryData', type: 'bytes' },
      { name: 'proposedPrice', type: 'int256' },
    ],
    outputs: [{ name: 'totalBond', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposeAndResolveNegRisk',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'adapter', type: 'address' },
      { name: 'negRiskOperator', type: 'address' },
      { name: 'adapterQuestionId', type: 'bytes32' },
      { name: 'negRiskOperatorQuestionId', type: 'bytes32' },
      { name: 'identifier', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'ancillaryData', type: 'bytes' },
      { name: 'proposedPrice', type: 'int256' },
    ],
    outputs: [{ name: 'totalBond', type: 'uint256' }],
  },
] as const

const DIRECT_RESOLUTION_ADDRESSES = new Set(
  [
    DIRECT_RESOLUTION_ORACLE_ADDRESS,
    DRO_CTF_ADAPTER_V4_ADDRESS,
    NEGRISK_OPERATOR_DRO_ADDRESS,
    NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS,
  ].map(address => address.toLowerCase()),
)
export type DirectResolutionErrorMessage
  = | 'Connected proposer wallet needs POL for gas before resolving this market.'
    | 'Transaction could not be sent because the gas fee is below the current network minimum.'
    | 'Wallet signature was rejected.'
    | 'You are not allowed to propose a result for this market.'
    | 'This market is already resolved.'
    | 'Could not submit resolution.'

function parseMarketMetadata(market: Event['markets'][number]): Record<string, unknown> {
  const metadata = market.metadata
  if (!metadata) {
    return {}
  }
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    }
    catch {
      return {}
    }
  }
  return typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getMarketResolutionType(market: Event['markets'][number]): ResolutionType {
  const metadata = parseMarketMetadata(market)
  const resolutionType = readMetadataString(metadata, 'resolution_type')
  if (resolutionType === 'dro_moov2' || resolutionType === 'uma_moov2') {
    return resolutionType
  }

  const candidates = [
    market.resolver,
    market.condition?.oracle,
    readMetadataString(metadata, 'resolver'),
    readMetadataString(metadata, 'resolution_adapter_address'),
  ]
  return candidates.some(candidate => candidate && DIRECT_RESOLUTION_ADDRESSES.has(candidate.toLowerCase()))
    ? 'dro_moov2'
    : 'legacy'
}

export function isDirectResolutionMarket(market: Event['markets'][number]) {
  return getMarketResolutionType(market) === 'dro_moov2'
}

export function getDirectResolutionAdapterAddress(market: Event['markets'][number]): Address | null {
  const metadata = parseMarketMetadata(market)
  const candidates = [
    readMetadataString(metadata, 'resolution_adapter_address'),
    market.condition?.oracle,
    market.neg_risk ? NEGRISK_DRO_CTF_ADAPTER_V4_ADDRESS : DRO_CTF_ADAPTER_V4_ADDRESS,
  ]
  for (const candidate of candidates) {
    const normalized = normalizeAddress(candidate)
    if (normalized && isAddress(normalized)) {
      return normalized as Address
    }
  }
  return null
}

export function getDirectResolutionQuestionIds(market: Event['markets'][number]): {
  adapterQuestionId: Hex | null
  negRiskOperatorQuestionId: Hex | null
} {
  const metadata = parseMarketMetadata(market)
  const negRiskRequestId = market.neg_risk_request_id ?? readMetadataString(metadata, 'neg_risk_request_id')
  const adapterQuestionId = market.neg_risk ? negRiskRequestId : market.question_id
  return {
    adapterQuestionId: adapterQuestionId ? adapterQuestionId as Hex : null,
    negRiskOperatorQuestionId: market.neg_risk ? market.question_id as Hex : null,
  }
}

export function getDirectResolutionOracleAddress(): Address {
  return DIRECT_RESOLUTION_ORACLE_ADDRESS
}

export function getDirectResolutionNegRiskOperatorAddress(): Address {
  return NEGRISK_OPERATOR_DRO_ADDRESS
}

export function getDirectResolutionPrice(outcome: DirectResolutionOutcome): bigint {
  if (outcome === 'yes') {
    return 1_000_000_000_000_000_000n
  }
  if (outcome === 'unknown') {
    return 500_000_000_000_000_000n
  }
  return 0n
}

export function readDirectResolutionError(error: unknown): DirectResolutionErrorMessage {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('insufficient funds')
    || lower.includes('exceeds the balance')
    || lower.includes('not enough native')
    || lower.includes('insufficient balance')
  ) {
    return 'Connected proposer wallet needs POL for gas before resolving this market.'
  }

  if (isGasFeeTooLowError(message)) {
    return 'Transaction could not be sent because the gas fee is below the current network minimum.'
  }

  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return 'Wallet signature was rejected.'
  }

  if (
    lower.includes('not whitelisted')
    || lower.includes('notwhitelisted')
    || lower.includes('unauthorized proposer')
    || lower.includes('proposer not authorized')
  ) {
    return 'You are not allowed to propose a result for this market.'
  }

  if (lower.includes('already resolved')) {
    return 'This market is already resolved.'
  }

  return 'Could not submit resolution.'
}
