import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'

interface ClobBuilderVolumeResponse {
  builder: string
  total: string
  periodTotal: string
  periodDays: number
  daily: Array<{ date: string; volume: string }>
  generatedAt: string
}

export interface BuilderVolumeSummary {
  total: number
  periodTotal: number
  daily: Array<{ date: string; value: number }>
}

function parseVolume(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new TypeError('CLOB builder volume contains an invalid amount')
  }
  return parsed
}

export async function fetchBuilderVolume(builder: string, days = 30): Promise<BuilderVolumeSummary> {
  const { clobUrl } = resolvePublicRuntimeEnv(process.env)
  const endpoint = new URL('/builder/volume', clobUrl)
  endpoint.searchParams.set('builder', builder)
  endpoint.searchParams.set('days', days.toString())

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) {
    throw new Error(`CLOB builder volume request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as ClobBuilderVolumeResponse
  if (!Array.isArray(payload.daily) || payload.periodDays !== days) {
    throw new TypeError('CLOB builder volume returned an invalid response')
  }

  return {
    total: parseVolume(payload.total),
    periodTotal: parseVolume(payload.periodTotal),
    daily: payload.daily.map((point) => ({ date: point.date, value: parseVolume(point.volume) })),
  }
}
