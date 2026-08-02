import { buildDataApiUrl } from '@/lib/data-api/client'

const DEFAULT_MIN_TRADED_MARKETS = 5

function getMinimumTradedMarkets() {
  const configured = Number.parseInt(process.env.RESOLUTION_REPORT_MIN_TRADED_MARKETS ?? '', 10)
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MIN_TRADED_MARKETS
}

export async function isEligibleToReportResolution(address: string) {
  const params = new URLSearchParams({ user: address.toLowerCase() })
  const response = await fetch(buildDataApiUrl('/traded', params), {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) {
    throw new Error(`Data API eligibility request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as { traded?: unknown }
  const tradedMarkets = Number(payload.traded)
  if (!Number.isFinite(tradedMarkets)) {
    throw new Error('Data API eligibility response is invalid.')
  }

  return tradedMarkets >= getMinimumTradedMarkets()
}
