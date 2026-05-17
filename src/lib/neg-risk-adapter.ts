import {
  NEGRISK_UMA_CTF_ADAPTER_ADDRESS,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'
import { normalizeAddress } from '@/lib/wallet'

const NEG_RISK_ADAPTER_BY_ADDRESS_OR_ORACLE: Record<string, `0x${string}`> = {
  [UMA_NEG_RISK_ADAPTER_ADDRESS.toLowerCase()]: UMA_NEG_RISK_ADAPTER_ADDRESS,
  [NEGRISK_UMA_CTF_ADAPTER_ADDRESS.toLowerCase()]: UMA_NEG_RISK_ADAPTER_ADDRESS,
}

const NEG_RISK_ADAPTER_METADATA_KEYS = [
  'adapter_address',
  'neg_risk_adapter_address',
  'negrisk_adapter_address',
  'resolution_adapter_address',
] as const

function parseMetadata(source: unknown): Record<string, unknown> | null {
  if (!source) {
    return null
  }

  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source) as unknown
      return parsed && typeof parsed === 'object'
        ? parsed as Record<string, unknown>
        : null
    }
    catch {
      return null
    }
  }

  return typeof source === 'object'
    ? source as Record<string, unknown>
    : null
}

function readSupportedAdapterAddressFromRecord(record: Record<string, unknown> | null): `0x${string}` | null {
  if (!record) {
    return null
  }

  for (const key of NEG_RISK_ADAPTER_METADATA_KEYS) {
    const candidate = record[key]
    if (typeof candidate !== 'string') {
      continue
    }
    const normalized = resolveSupportedNegRiskAdapterAddress(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function resolveCurrentNegRiskAdapterAddress(value: string | null | undefined): `0x${string}` | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return NEG_RISK_ADAPTER_BY_ADDRESS_OR_ORACLE[normalized] ?? null
}

function resolveSupportedNegRiskAdapterAddress(value: string | null | undefined): `0x${string}` | null {
  const normalized = normalizeAddress(value)
  if (!normalized) {
    return null
  }

  return resolveCurrentNegRiskAdapterAddress(normalized)
    ? normalized
    : null
}

export function resolveNegRiskAdapterAddressFromMetadata(
  metadata: unknown,
  fallbackOracle?: string | null,
): `0x${string}` | null {
  return readSupportedAdapterAddressFromRecord(parseMetadata(metadata))
    ?? normalizeAddress(fallbackOracle)
}

export function isCurrentNegRiskAdapterAddress(value: string | null | undefined): value is `0x${string}` {
  return resolveCurrentNegRiskAdapterAddress(value) !== null
}

export function assertCurrentNegRiskAdapterAddress(value: string | null | undefined): `0x${string}` {
  if (!value) {
    return UMA_NEG_RISK_ADAPTER_ADDRESS
  }

  const resolved = resolveCurrentNegRiskAdapterAddress(value)
  if (!resolved) {
    throw new Error('UNSUPPORTED_NEG_RISK_ADAPTER')
  }
  return resolved
}
