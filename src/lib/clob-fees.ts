import 'server-only'

export interface KuestFeeSettings {
  takerFeeBps: number | null
  makerFeeBps: number | null
}

const CLOB_FEE_RATE_PATH = '/fee-rate'

function readNumberField(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function hasField(payload: unknown, key: string) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && Object.hasOwn(payload, key),
  )
}

function normalizeFeeBps(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return null
  }

  return Math.round(value)
}

function parseKuestFeeSettings(payload: unknown): KuestFeeSettings {
  const takerFeeBps = normalizeFeeBps(readNumberField(payload, 'base_fee'))
  if (takerFeeBps === null) {
    return {
      takerFeeBps: null,
      makerFeeBps: null,
    }
  }

  return {
    takerFeeBps,
    makerFeeBps: hasField(payload, 'maker_fee')
      ? normalizeFeeBps(readNumberField(payload, 'maker_fee'))
      : 0,
  }
}

export async function fetchKuestFeeSettings(): Promise<KuestFeeSettings | null> {
  try {
    const response = await fetch(`${process.env.CLOB_URL}${CLOB_FEE_RATE_PATH}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 300,
      },
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      console.warn('Failed to load Kuest fee settings', response.status)
      return null
    }

    const payload = await response.json().catch(() => null)
    return parseKuestFeeSettings(payload)
  }
  catch (error) {
    console.warn('Failed to load Kuest fee settings', error)
    return null
  }
}
