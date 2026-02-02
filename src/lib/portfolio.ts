import { normalizeAddress } from '@/lib/wallet'

const DATA_API_URL = process.env.DATA_URL!

export interface PortfolioSnapshot {
  positionsValue: number
  profitLoss: number
  predictions: number
  biggestWin: number
}

const defaultSnapshot: PortfolioSnapshot = {
  positionsValue: 0,
  profitLoss: 0,
  predictions: 0,
  biggestWin: 0,
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function parsePortfolioValue(body: any): number {
  if (!body) {
    return 0
  }

  if (Array.isArray(body)) {
    return toNumber(body[0]?.value ?? body[0])
  }

  if (typeof body === 'object' && 'value' in body) {
    return toNumber((body as { value: unknown }).value)
  }

  return toNumber(body)
}

function parseTradedCount(body: any): number {
  if (!body) {
    return 0
  }

  if (typeof body === 'object' && 'traded' in body) {
    return toNumber((body as { traded: unknown }).traded)
  }

  return toNumber(body)
}

async function fetchJson(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return await response.json()
}

export async function fetchPortfolioSnapshot(userAddress?: string | null): Promise<PortfolioSnapshot> {
  if (!userAddress) {
    return defaultSnapshot
  }

  const address = normalizeAddress(userAddress)
  if (!address) {
    return defaultSnapshot
  }

  try {
    const valueUrl = `${DATA_API_URL}/value?user=${encodeURIComponent(address)}`
    const activeParams = new URLSearchParams({
      user: address,
      limit: '100',
      offset: '0',
      sizeThreshold: '0.01',
      sortDirection: 'DESC',
    })
    const closedParams = new URLSearchParams({
      user: address,
      limit: '100',
      offset: '0',
      sortBy: 'TIMESTAMP',
      sortDirection: 'DESC',
      sizeThreshold: '0.01',
    })

    const tradedUrl = `${DATA_API_URL}/traded?user=${encodeURIComponent(address)}`

    const [valueResult, activePositionsResult, closedPositionsResult, tradedResult] = await Promise.allSettled([
      fetchJson(valueUrl),
      fetchJson(`${DATA_API_URL}/positions?${activeParams.toString()}`),
      fetchJson(`${DATA_API_URL}/closed-positions?${closedParams.toString()}`),
      fetchJson(tradedUrl),
    ])

    const positionsValue = valueResult.status === 'fulfilled'
      ? parsePortfolioValue(valueResult.value)
      : 0

    const activePositions = activePositionsResult.status === 'fulfilled' && Array.isArray(activePositionsResult.value)
      ? activePositionsResult.value
      : []

    const closedPositions = closedPositionsResult.status === 'fulfilled' && Array.isArray(closedPositionsResult.value)
      ? closedPositionsResult.value
      : []

    const tradedCount = tradedResult.status === 'fulfilled'
      ? parseTradedCount(tradedResult.value)
      : 0

    const predictions = tradedCount || (activePositions.length + closedPositions.length)

    const profitLossActive = activePositions.reduce(
      (total, position) => total + toNumber((position as any).cashPnl),
      0,
    )
    const profitLossClosed = closedPositions.reduce(
      (total, position) => total + toNumber((position as any).realizedPnl),
      0,
    )

    const biggestWin = closedPositions.reduce((max, position) => {
      const realized = toNumber((position as any).realizedPnl)
      return realized > max ? realized : max
    }, 0)

    return {
      positionsValue,
      profitLoss: profitLossActive + profitLossClosed,
      predictions,
      biggestWin,
    }
  }
  catch (error) {
    console.error('Failed to fetch portfolio snapshot', error)
    return defaultSnapshot
  }
}
