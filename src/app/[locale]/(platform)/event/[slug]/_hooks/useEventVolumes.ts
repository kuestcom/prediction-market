import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Event } from '@/types'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'

const MAX_VOLUME_CONDITIONS_PER_REQUEST = 100
const VOLUME_REFRESH_INTERVAL_MS = 60_000

interface VolumeConditionRequest {
  condition_id: string
  token_ids: [string, string]
}

interface VolumeResponse {
  condition_id?: string
  status?: number
  volume?: string
}

export type EventVolumesByCondition = Record<string, number>

function buildVolumeConditions(event: Event): VolumeConditionRequest[] {
  const conditionsById = new Map<string, VolumeConditionRequest>()

  for (const market of event.markets) {
    const tokenIds = (market.outcomes ?? [])
      .map((outcome) => outcome.token_id)
      .filter(Boolean)
      .slice(0, 2)

    if (!market.condition_id || tokenIds.length < 2 || conditionsById.has(market.condition_id)) {
      continue
    }

    conditionsById.set(market.condition_id, {
      condition_id: market.condition_id,
      token_ids: tokenIds as [string, string],
    })
  }

  return Array.from(conditionsById.values())
}

async function fetchEventVolumes(
  conditions: VolumeConditionRequest[],
  clobUrl: string,
): Promise<EventVolumesByCondition> {
  if (!conditions.length || !clobUrl) {
    return {}
  }

  const chunks: VolumeConditionRequest[][] = []
  for (let index = 0; index < conditions.length; index += MAX_VOLUME_CONDITIONS_PER_REQUEST) {
    chunks.push(conditions.slice(index, index + MAX_VOLUME_CONDITIONS_PER_REQUEST))
  }

  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(`${clobUrl}/data/volumes`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          include_24h: false,
          conditions: chunk,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch event volumes (${response.status} ${response.statusText}).`)
      }

      const payload = (await response.json()) as unknown
      return Array.isArray(payload) ? (payload as VolumeResponse[]) : []
    }),
  )

  return responses.flat().reduce<EventVolumesByCondition>((volumeByCondition, entry) => {
    if (entry?.status !== 200 || !entry.condition_id) {
      return volumeByCondition
    }

    const volume = Number(entry.volume ?? 0)
    if (Number.isFinite(volume)) {
      volumeByCondition[entry.condition_id] = volume
    }

    return volumeByCondition
  }, {})
}

export function useEventVolumes(event: Event) {
  const { clobUrl } = usePublicRuntimeConfig()
  const conditions = useMemo(() => buildVolumeConditions(event), [event])
  const signature = useMemo(
    () => conditions.map((condition) => `${condition.condition_id}:${condition.token_ids.join(':')}`).join('|'),
    [conditions],
  )
  const { data } = useQuery({
    queryKey: ['trade-volumes', clobUrl, event.id, signature],
    queryFn: () => fetchEventVolumes(conditions, clobUrl),
    enabled: conditions.length > 0 && Boolean(clobUrl),
    staleTime: VOLUME_REFRESH_INTERVAL_MS,
    refetchInterval: VOLUME_REFRESH_INTERVAL_MS,
    retry: false,
  })

  const volumeByCondition = data ?? {}
  const totalVolume = useMemo(
    () => (data ? Object.values(data).reduce((total, volume) => total + volume, 0) : null),
    [data],
  )

  return { volumeByCondition, totalVolume }
}
