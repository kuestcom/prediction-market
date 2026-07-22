const COMPACT_SPORTS_TEAM_NAME_MAX_LENGTH = 12
const SPORTS_PERIOD_SUFFIX_PATTERN = /\s+([12]H)$/i

export interface CompactSportsTeamLabelInput {
  name: string | null | undefined
  fallback: string
}

function normalizeLabel(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

export function resolveSportsButtonPeriodSuffix(label: string | null | undefined) {
  return normalizeLabel(label).match(SPORTS_PERIOD_SUFFIX_PATTERN)?.[1]?.toUpperCase() ?? null
}

export function preserveSportsButtonPeriodSuffix(label: string, sourceLabel: string) {
  const suffix = resolveSportsButtonPeriodSuffix(sourceLabel)
  const normalizedLabel = normalizeLabel(label)
  return suffix && resolveSportsButtonPeriodSuffix(normalizedLabel) !== suffix
    ? `${normalizedLabel} ${suffix}`
    : normalizedLabel
}

function stripSportsButtonPeriodSuffix(label: string) {
  return normalizeLabel(label).replace(SPORTS_PERIOD_SUFFIX_PATTERN, '')
}

function resolveBaseLabelMaxLength(fallback: string) {
  const suffix = resolveSportsButtonPeriodSuffix(fallback)
  return COMPACT_SPORTS_TEAM_NAME_MAX_LENGTH - (suffix ? suffix.length + 1 : 0)
}

function resolveBoundedFallback(name: string | null | undefined, fallback: string) {
  const maxLength = resolveBaseLabelMaxLength(fallback)
  const fallbackBase = stripSportsButtonPeriodSuffix(fallback)
  const normalizedName = normalizeLabel(name)
  const baseLabel = fallbackBase || normalizedName
  const boundedBaseLabel = baseLabel.length <= maxLength
    ? baseLabel
    : baseLabel.slice(0, maxLength).trim()

  return preserveSportsButtonPeriodSuffix(boundedBaseLabel, fallback)
}

function resolveCompactSportsTeamName(
  name: string | null | undefined,
  fallback: string,
) {
  const normalizedName = normalizeLabel(name)
  const maxLength = resolveBaseLabelMaxLength(fallback)
  if (!normalizedName) {
    return resolveBoundedFallback(name, fallback)
  }
  if (normalizedName.length <= maxLength) {
    return preserveSportsButtonPeriodSuffix(normalizedName, fallback)
  }

  const words = normalizedName.split(' ')
  let compactName = ''

  for (const word of words) {
    const candidate = compactName ? `${compactName} ${word}` : word
    if (candidate.length > maxLength) {
      break
    }
    compactName = candidate
  }

  return compactName
    ? preserveSportsButtonPeriodSuffix(compactName, fallback)
    : resolveBoundedFallback(name, fallback)
}

function normalizeComparableLabel(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
}

function ensureDistinctCollisionMarkers(firstMarker: string | undefined, secondMarker: string | undefined) {
  const resolvedFirstMarker = firstMarker?.toUpperCase() ?? '1'
  const resolvedSecondMarker = secondMarker?.toUpperCase() ?? '2'

  return resolvedFirstMarker === resolvedSecondMarker
    ? [resolvedFirstMarker, resolvedFirstMarker === '1' ? '2' : '1'] as const
    : [resolvedFirstMarker, resolvedSecondMarker] as const
}

function resolveCollisionMarkers(firstName: string | null | undefined, secondName: string | null | undefined) {
  const firstComparable = normalizeComparableLabel(normalizeLabel(firstName)).replace(/[^a-z0-9]/g, '')
  const secondComparable = normalizeComparableLabel(normalizeLabel(secondName)).replace(/[^a-z0-9]/g, '')
  const maxLength = Math.max(firstComparable.length, secondComparable.length)

  for (let index = 0; index < maxLength; index += 1) {
    if (firstComparable[index] !== secondComparable[index]) {
      return ensureDistinctCollisionMarkers(firstComparable[index], secondComparable[index])
    }
  }

  return ['1', '2'] as const
}

function appendCollisionMarker(label: string, fallback: string, marker: string) {
  const maxBaseLength = Math.max(1, resolveBaseLabelMaxLength(fallback) - marker.length - 1)
  const baseLabel = stripSportsButtonPeriodSuffix(label).slice(0, maxBaseLength).trim()
  return preserveSportsButtonPeriodSuffix(`${baseLabel} ${marker}`, fallback)
}

export function resolveCompactSportsTeamNames(
  first: CompactSportsTeamLabelInput,
  second: CompactSportsTeamLabelInput,
): [string, string] {
  const compactLabels: [string, string] = [
    resolveCompactSportsTeamName(first.name, first.fallback),
    resolveCompactSportsTeamName(second.name, second.fallback),
  ]

  if (normalizeComparableLabel(compactLabels[0]) !== normalizeComparableLabel(compactLabels[1])) {
    return compactLabels
  }

  const fallbackLabels: [string, string] = [
    resolveBoundedFallback(first.name, first.fallback),
    resolveBoundedFallback(second.name, second.fallback),
  ]

  if (normalizeComparableLabel(fallbackLabels[0]) !== normalizeComparableLabel(fallbackLabels[1])) {
    return fallbackLabels
  }

  const markers = resolveCollisionMarkers(first.name, second.name)
  return [
    appendCollisionMarker(compactLabels[0], first.fallback, markers[0]),
    appendCollisionMarker(compactLabels[1], second.fallback, markers[1]),
  ]
}
