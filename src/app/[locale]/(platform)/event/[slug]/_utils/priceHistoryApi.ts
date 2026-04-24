export interface PriceHistoryPoint {
  t: number
  p: number
}

export interface RangeFilters {
  fidelity: string
  interval?: string
  startTs?: string
  endTs?: string
}

export type PriceHistoryByKey = Record<string, PriceHistoryPoint[]>

interface BatchPriceHistoryResponse {
  history?: Record<string, unknown>
}

const MAX_BATCH_PRICE_HISTORY_MARKETS = 20

function chunkValues<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize))
  }

  return chunks
}

function normalizePriceHistoryPoints(points: unknown): PriceHistoryPoint[] {
  if (!Array.isArray(points)) {
    return []
  }

  return points
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null
      }

      return {
        t: Number((point as { t?: unknown }).t),
        p: Number((point as { p?: unknown }).p),
      }
    })
    .filter((point): point is PriceHistoryPoint => {
      return point !== null
        && Number.isFinite(point.t)
        && Number.isFinite(point.p)
    })
}

export function buildBatchPriceHistoryRequestBody(tokenIds: string[], filters: RangeFilters) {
  const requestBody: Record<string, unknown> = {
    markets: tokenIds,
  }

  if (filters.interval) {
    requestBody.interval = filters.interval
  }

  if (filters.fidelity) {
    requestBody.fidelity = Number(filters.fidelity)
  }

  if (filters.startTs) {
    requestBody.startTs = Number(filters.startTs)
  }

  if (filters.endTs) {
    requestBody.endTs = Number(filters.endTs)
  }

  return requestBody
}

export async function fetchBatchPriceHistoryByTokenIds(tokenIds: string[], filters: RangeFilters): Promise<PriceHistoryByKey> {
  const uniqueTokenIds = Array.from(new Set(tokenIds.filter(Boolean)))

  if (!uniqueTokenIds.length) {
    return {}
  }

  const tokenIdChunks = chunkValues(uniqueTokenIds, MAX_BATCH_PRICE_HISTORY_MARKETS)
  const historyByChunk = await Promise.all(
    tokenIdChunks.map(async (tokenIdChunk) => {
      try {
        const response = await fetch(`${process.env.CLOB_URL!}/batch-prices-history`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBatchPriceHistoryRequestBody(tokenIdChunk, filters)),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch price history')
        }

        const payload = await response.json() as BatchPriceHistoryResponse
        return tokenIdChunk.reduce<PriceHistoryByKey>((acc, tokenId) => {
          acc[tokenId] = normalizePriceHistoryPoints(payload.history?.[tokenId])
          return acc
        }, {})
      }
      catch {
        return tokenIdChunk.reduce<PriceHistoryByKey>((acc, tokenId) => {
          acc[tokenId] = []
          return acc
        }, {})
      }
    }),
  )

  return Object.assign({}, ...historyByChunk)
}

export function mapTokenHistoryToConditionHistory<T extends { conditionId: string, tokenId: string }>(
  targets: T[],
  historyByToken: PriceHistoryByKey,
): PriceHistoryByKey {
  return Object.fromEntries(
    targets.map(target => [target.conditionId, historyByToken[target.tokenId] ?? []] as const),
  )
}
