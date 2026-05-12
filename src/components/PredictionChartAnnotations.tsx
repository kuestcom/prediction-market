'use client'

import type { Dispatch, ReactElement, SetStateAction } from 'react'
import type { PredictionChartAnnotationMarker } from '@/types/PredictionChartTypes'

const ANNOTATION_CLUSTER_DISTANCE_PX = 10

export interface ResolvedAnnotationMarker extends PredictionChartAnnotationMarker {
  x: number
  y: number
}

export interface ResolvedAnnotationCluster {
  id: string
  x: number
  y: number
  color: string
  radius: number
  markers: ResolvedAnnotationMarker[]
}

export function resolveAnnotationMarkers(
  annotationMarkers: PredictionChartAnnotationMarker[],
  xScale: (value: Date) => number,
  yScale: (value: number) => number,
  innerWidth: number,
  innerHeight: number,
): ResolvedAnnotationMarker[] {
  return annotationMarkers.reduce<ResolvedAnnotationMarker[]>((markers, marker) => {
    const timestamp = marker.date?.getTime?.()
    if (!Number.isFinite(timestamp)) {
      return markers
    }
    if (!Number.isFinite(marker.value)) {
      return markers
    }

    const x = xScale(marker.date)
    const y = yScale(marker.value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return markers
    }
    if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
      return markers
    }

    markers.push({
      ...marker,
      x,
      y,
    })
    return markers
  }, [])
}

export function clusterAnnotationMarkers(
  resolvedMarkers: ResolvedAnnotationMarker[],
): ResolvedAnnotationCluster[] {
  if (!resolvedMarkers.length) {
    return []
  }

  return resolvedMarkers
    .slice()
    .sort((a, b) => a.x - b.x)
    .reduce<ResolvedAnnotationCluster[]>((clusters, marker) => {
      let closestCluster: ResolvedAnnotationCluster | undefined
      let closestDistance = Number.POSITIVE_INFINITY

      for (const cluster of clusters) {
        const distance = Math.hypot(marker.x - cluster.x, marker.y - cluster.y)
        if (distance <= ANNOTATION_CLUSTER_DISTANCE_PX && distance < closestDistance) {
          closestDistance = distance
          closestCluster = cluster
        }
      }

      if (!closestCluster) {
        clusters.push({
          id: `annotation-cluster-${marker.id}`,
          x: marker.x,
          y: marker.y,
          color: marker.color || '#94A3B8',
          radius: Number.isFinite(marker.radius) && (marker.radius as number) > 0
            ? marker.radius as number
            : 3.4,
          markers: [marker],
        })
        return clusters
      }

      closestCluster.markers.push(marker)

      const clusterSize = closestCluster.markers.length
      closestCluster.x = closestCluster.markers.reduce((sum, item) => sum + item.x, 0) / clusterSize
      closestCluster.y = closestCluster.markers.reduce((sum, item) => sum + item.y, 0) / clusterSize

      const hasDifferentColor = closestCluster.markers.some(item => (item.color || '#94A3B8') !== closestCluster.color)
      if (hasDifferentColor) {
        closestCluster.color = 'var(--muted-foreground)'
      }

      const maxMarkerRadius = closestCluster.markers.reduce((maxRadius, item) => {
        const resolvedRadius = Number.isFinite(item.radius) && (item.radius as number) > 0
          ? item.radius as number
          : 3.4
        return Math.max(maxRadius, resolvedRadius)
      }, 3.4)

      closestCluster.radius = clusterSize > 1
        ? Math.min(6, maxMarkerRadius + 1.1)
        : maxMarkerRadius

      return clusters
    }, [])
}

interface PredictionChartAnnotationDotsProps {
  clusters: ResolvedAnnotationCluster[]
  setHoveredAnnotationClusterId: Dispatch<SetStateAction<string | null>>
  handleTooltip: (event: any) => void
}

function PredictionChartAnnotationDots({
  clusters,
  setHoveredAnnotationClusterId,
  handleTooltip,
}: PredictionChartAnnotationDotsProps): ReactElement {
  return (
    <>
      {clusters.map((cluster) => {
        return (
          <circle
            key={cluster.id}
            cx={cluster.x}
            cy={cluster.y}
            r={cluster.radius}
            fill={cluster.color}
            stroke="var(--background)"
            strokeWidth={1.2}
            className="cursor-pointer"
            onMouseEnter={(event) => {
              setHoveredAnnotationClusterId(cluster.id)
              handleTooltip(event as any)
            }}
            onMouseMove={(event) => {
              setHoveredAnnotationClusterId(cluster.id)
              handleTooltip(event as any)
            }}
            onMouseLeave={() => {
              setHoveredAnnotationClusterId((current) => {
                if (current !== cluster.id) {
                  return current
                }
                return null
              })
            }}
            onFocus={() => {
              setHoveredAnnotationClusterId(cluster.id)
            }}
            onBlur={() => {
              setHoveredAnnotationClusterId((current) => {
                if (current !== cluster.id) {
                  return current
                }
                return null
              })
            }}
          />
        )
      })}
    </>
  )
}

interface PredictionChartAnnotationTooltipProps {
  cluster: ResolvedAnnotationCluster
  position: { left: number, top: number }
}

function PredictionChartAnnotationTooltip({
  cluster,
  position,
}: PredictionChartAnnotationTooltipProps): ReactElement {
  return (
    <div
      className="
        pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover
        px-2.5 py-1.5 shadow-md
      "
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {cluster.markers.length > 1
        ? (
            <div className="flex flex-col gap-1.5">
              {cluster.markers
                .slice()
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map(marker => (
                  <div key={`${cluster.id}-${marker.id}`}>
                    {marker.tooltipContent}
                  </div>
                ))}
            </div>
          )
        : cluster.markers[0]?.tooltipContent}
    </div>
  )
}

export { PredictionChartAnnotationDots, PredictionChartAnnotationTooltip }
