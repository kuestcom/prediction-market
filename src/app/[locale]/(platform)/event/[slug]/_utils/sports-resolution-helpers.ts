import type { Event, SportsTeam } from '@/types'
import {
  doesTextMatchTeam as doesSharedTextMatchTeam,
  findMatchingTeamInText,
  normalizeComparableText,
  parseSportsScore,
} from '@/lib/sports-resolution'

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

export { normalizeComparableText, parseSportsScore }

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
  return doesSharedTextMatchTeam(value, team)
}

export function resolveTeamNameFromText(
  value: string | null | undefined,
  event: Pick<Event, 'sports_teams'> | null | undefined,
) {
  const { teams } = resolveEventTeams(event)
  return findMatchingTeamInText(value, teams)?.name ?? null
}
