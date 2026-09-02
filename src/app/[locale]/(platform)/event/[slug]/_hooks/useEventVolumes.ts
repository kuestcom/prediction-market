import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import type { Event } from '@/types'

import { useOptionalMarketChannelLiveVolumes } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'

const MAX_VOLUME_CONDITIONS_PER_REQUEST = 100
const VOLUME_REFRESH_INTERVAL_MS = 60_000

interface VolumeConditionRequest {
  condition_id: string
  token_ids: [string, string]
}

interface VolumeResponse {
  condition_id?: unknown
  status?: unknown
  volume?: unknown
}

type EventVolumesByCondition = Record<string, number>

interface EventVolumesResult {
  volumeByCondition: EventVolumesByCondition
  isComplete: boolean
}

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

function parseVolumeValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function parseVolumeResponse(payload: unknown, conditions: VolumeConditionRequest[]): EventVolumesResult {
  if (!Array.isArray(payload)) {
    return { volumeByCondition: {}, isComplete: false }
  }

  const requestedConditionIds = new Set(conditions.map((condition) => condition.condition_id))
  const volumeByCondition: EventVolumesByCondition = {}

  for (const entry of payload) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const responseEntry = entry as VolumeResponse
    const conditionId = responseEntry.condition_id
    const volume = parseVolumeValue(responseEntry.volume)

    if (
      typeof conditionId !== 'string' ||
      typeof responseEntry.status !== 'number' ||
      (responseEntry.volume !== undefined && volume === null)
    ) {
      continue
    }

    if (!requestedConditionIds.has(conditionId) || responseEntry.status !== 200 || volume === null) {
      continue
    }

    volumeByCondition[conditionId] = volume
  }

  const isComplete = conditions.every((condition) => volumeByCondition[condition.condition_id] !== undefined)

  return { volumeByCondition, isComplete }
}

async function fetchEventVolumes(conditions: VolumeConditionRequest[], clobUrl: string): Promise<EventVolumesResult> {
  if (!conditions.length || !clobUrl) {
    return { volumeByCondition: {}, isComplete: false }
  }

  const chunks: VolumeConditionRequest[][] = []
  for (let index = 0; index < conditions.length; index += MAX_VOLUME_CONDITIONS_PER_REQUEST) {
    chunks.push(conditions.slice(index, index + MAX_VOLUME_CONDITIONS_PER_REQUEST))
  }

  const responses = await Promise.allSettled(
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
      return parseVolumeResponse(payload, chunk)
    }),
  )

  const result: EventVolumesResult = {
    volumeByCondition: {},
    isComplete: true,
  }

  for (const response of responses) {
    if (response.status === 'rejected') {
      result.isComplete = false
      continue
    }

    Object.assign(result.volumeByCondition, response.value.volumeByCondition)
    result.isComplete = result.isComplete && response.value.isComplete
  }

  return result
}

export function useEventVolumes(event: Event) {
  const { clobUrl } = usePublicRuntimeConfig()
  const { liveVolumeByCondition, resetLiveVolumes } = useOptionalMarketChannelLiveVolumes()
  const conditions = useMemo(() => buildVolumeConditions(event), [event])
  const signature = useMemo(
    () => conditions.map((condition) => `${condition.condition_id}:${condition.token_ids.join(':')}`).join('|'),
    [conditions],
  )
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['trade-volumes', clobUrl, event.id, signature],
    queryFn: () => fetchEventVolumes(conditions, clobUrl),
    enabled: conditions.length > 0 && Boolean(clobUrl),
    staleTime: VOLUME_REFRESH_INTERVAL_MS,
    refetchInterval: VOLUME_REFRESH_INTERVAL_MS,
    retry: false,
  })

  const previousDataUpdatedAtRef = useRef(dataUpdatedAt)
  useEffect(() => {
    if (!dataUpdatedAt) {
      return
    }

    const previousDataUpdatedAt = previousDataUpdatedAtRef.current
    previousDataUpdatedAtRef.current = dataUpdatedAt

    if (previousDataUpdatedAt !== dataUpdatedAt) {
      resetLiveVolumes()
    }
  }, [dataUpdatedAt, resetLiveVolumes])

  const volumeByCondition = data?.volumeByCondition ?? {}
  const totalVolume = useMemo(
    () =>
      data?.isComplete
        ? conditions.reduce((total, condition) => total + (data.volumeByCondition[condition.condition_id] ?? 0), 0) +
          conditions.reduce((total, condition) => total + (liveVolumeByCondition[condition.condition_id] ?? 0), 0)
        : null,
    [conditions, data, liveVolumeByCondition],
  )

  return { liveVolumeByCondition, volumeByCondition, totalVolume }
}
