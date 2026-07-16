const POLYMARKET_TICK_SIZES = [
  '0.1',
  '0.01',
  '0.005',
  '0.0025',
  '0.001',
  '0.0001',
] as const

export type PolymarketTickSize = typeof POLYMARKET_TICK_SIZES[number]

export function normalizePolymarketTickSize(value: unknown): PolymarketTickSize | null {
  const normalized = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : ''

  return POLYMARKET_TICK_SIZES.find(tickSize => tickSize === normalized) ?? null
}
