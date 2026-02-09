export interface FeeReceiverTotal {
  exchange: string
  receiver: string
  tokenId: string
  totalAmount: string
  updatedAt: number
}

interface FeeReceiverTotalsParams {
  endpoint: 'referrers'
  address: string
  exchange?: string
  tokenId?: string
  limit?: number
  offset?: number
}

const DATA_API_URL = process.env.DATA_URL!

function assertDataApiUrl() {
  if (!DATA_API_URL) {
    throw new Error('DATA_URL environment variable is not configured.')
  }
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

export async function fetchFeeReceiverTotals({
  endpoint,
  address,
  exchange,
  tokenId,
  limit = 100,
  offset = 0,
}: FeeReceiverTotalsParams): Promise<FeeReceiverTotal[]> {
  assertDataApiUrl()

  const params = new URLSearchParams()
  params.set('address', normalizeAddress(address))
  if (exchange) {
    params.set('exchange', normalizeAddress(exchange))
  }
  if (tokenId) {
    params.set('tokenId', tokenId)
  }
  params.set('limit', Math.min(Math.max(limit, 1), 500).toString())
  params.set('offset', Math.max(offset, 0).toString())

  const response = await fetch(`${DATA_API_URL}/${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Data API request failed: ${endpoint} (${response.status})`)
  }

  return response.json() as Promise<FeeReceiverTotal[]>
}

export function sumFeeTotalsByToken(totals: FeeReceiverTotal[], tokenId: string): bigint {
  return totals.reduce((acc, total) => {
    if (total.tokenId === tokenId) {
      try {
        return acc + BigInt(total.totalAmount)
      }
      catch {
        return acc
      }
    }
    return acc
  }, 0n)
}

export function sumFeeTotals(totals: FeeReceiverTotal[]): bigint {
  return totals.reduce((acc, total) => {
    try {
      return acc + BigInt(total.totalAmount)
    }
    catch {
      return acc
    }
  }, 0n)
}

export function baseUnitsToNumber(amount: bigint, decimals = 6): number {
  if (decimals <= 0) {
    return Number(amount)
  }
  return Number(amount) / 10 ** decimals
}
