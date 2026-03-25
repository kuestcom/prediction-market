import type { Event, SportsTeam } from '@/types'

export interface ResolvedSportsTeam {
  name: string
  abbreviation: string
  hostStatus: string
}

function normalizeSportsTeams(teams: SportsTeam[] | null | undefined) {
  return (teams ?? [])
    .map(team => ({
      name: team?.name?.trim() ?? '',
      abbreviation: team?.abbreviation?.trim() ?? '',
      hostStatus: team?.host_status?.trim().toLowerCase() ?? '',
    }))
    .filter(team => team.name.length > 0)
}

function findMatchingTeamInList(
  value: string | null | undefined,
  teams: ResolvedSportsTeam[],
) {
  const normalizedValue = normalizeComparableText(value)
  if (!normalizedValue) {
    return null
  }

  const teamsByLength = [...teams].sort((left, right) => right.name.length - left.name.length)
  const matchedByName = teamsByLength.find((team) => {
    const normalizedName = normalizeComparableText(team.name)
    return normalizedName.length > 0 && normalizedValue.includes(normalizedName)
  })
  if (matchedByName) {
    return matchedByName
  }

  const tokens = new Set(normalizedValue.split(' ').filter(Boolean))
  return teamsByLength.find((team) => {
    const normalizedAbbreviation = normalizeComparableText(team.abbreviation)
    return normalizedAbbreviation.length > 0 && tokens.has(normalizedAbbreviation)
  }) ?? null
}

export function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

export function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return null
  }

  const team1 = Number.parseInt(match[1] ?? '', 10)
  const team2 = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
    return null
  }

  return { team1, team2 }
}

export function resolveSportsTeams(teams: SportsTeam[] | null | undefined) {
  const normalizedTeams = normalizeSportsTeams(teams)
  const homeTeam = normalizedTeams.find(team => team.hostStatus === 'home') ?? normalizedTeams[0] ?? null
  const awayTeam = normalizedTeams.find(team => team.hostStatus === 'away')
    ?? normalizedTeams.find(team => team !== homeTeam)
    ?? null

  return {
    teams: normalizedTeams,
    homeTeam,
    awayTeam,
  }
}

export function resolveEventTeams(event: Pick<Event, 'sports_teams'> | null | undefined) {
  return resolveSportsTeams(event?.sports_teams)
}

export function doesTextMatchTeam(
  value: string | null | undefined,
  team: ResolvedSportsTeam | null,
) {
  if (!team) {
    return false
  }

  return findMatchingTeamInList(value, [team]) != null
}

export function resolveTeamNameFromText(
  value: string | null | undefined,
  event: Pick<Event, 'sports_teams'> | null | undefined,
) {
  const { teams } = resolveEventTeams(event)
  return findMatchingTeamInList(value, teams)?.name ?? null
}
