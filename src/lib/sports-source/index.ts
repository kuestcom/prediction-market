import type { SportsSourceProvider } from '@/lib/sports-source/providers'
import type { SportsSourceSearchTeam } from '@/lib/sports-source/search-query'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { slugifyText } from '@/lib/slug'
import {
  DEFAULT_SPORTS_SOURCE_PROVIDER_ORDER,
  getConfiguredSportsSourceProviders,
  normalizeSportsSourceProviderTokens,
} from '@/lib/sports-source/providers'
import { buildSportsSourceMatchupSearchQuery } from '@/lib/sports-source/search-query'
import 'server-only'

export type { SportsSourceProvider } from '@/lib/sports-source/providers'

interface SportsSourceTeam {
  name: string
  abbreviation?: string | null
  slug?: string | null
  logo?: string | null
  hostStatus?: 'home' | 'away' | null
}

export interface SportsSourceCandidate {
  provider: SportsSourceProvider
  eventId: string
  eventName?: string | null
  gameId: string | null
  leagueId: string | null
  leagueName: string | null
  leagueSlug: string | null
  sportSlug: string | null
  eventDate?: string | null
  startTime: string | null
  homeTeam: SportsSourceTeam | null
  awayTeam: SportsSourceTeam | null
  score: string | null
  period: string | null
  elapsed: string | null
  live: boolean | null
  ended: boolean | null
  livestreamUrl: string | null
  livestreamEmbedUrl: string | null
  livestreamProvider: string | null
  livestreamOfficial: boolean | null
  confidence: number
  matchReason: string[]
  raw: Record<string, unknown>
}

export interface SportsSourceSearchParams {
  q?: string | null
  sport?: string | null
  league?: string | null
  series?: string | null
  date?: string | null
  category?: string | null
  tags?: string[] | null
  provider?: string | null
  limit?: number | null
  auth?: SportsSourceAuth | null
}

export interface SportsSourceResolveParams {
  provider?: string | null
  eventId?: string | null
  gameId?: string | null
  auth?: SportsSourceAuth | null
}

export interface SportsSourceSuggestParams {
  title?: string | null
  question?: string | null
  outcomes?: string[] | null
  teams?: SportsSourceSearchTeam[] | null
  description?: string | null
  slug?: string | null
  tags?: string[] | null
  category?: string | null
  date?: string | null
  sport?: string | null
  league?: string | null
  series?: string | null
  provider?: string | null
  limit?: number | null
  auth?: SportsSourceAuth | null
}

interface SportsSourceAuth {
  pandascoreToken?: string | null
  theSportsDbApiKey?: string | null
}

interface SportsMatchHints {
  query: string
  teams: string[]
  sport: string | null
  league: string | null
  date: string | null
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25
const REQUEST_TIMEOUT_MS = 12_000
const YOUTUBE_OR_TWITCH_HOST_PATTERN = /(?:^|\.)(?:youtube\.com|youtu\.be|twitch\.tv)$/i
const THE_SPORTS_DB_FALLBACK_LIMIT = 100
const PANDASCORE_DATE_SEARCH_LIMIT = 100
const PANDASCORE_VIDEOGAME_ENDPOINTS: Record<string, string> = {
  'call': 'codmw',
  'call-of-duty': 'codmw',
  'call-of-duty-modern-warfare': 'codmw',
  'cod': 'codmw',
  'codmw': 'codmw',
  'counter-strike': 'csgo',
  'counter-strike-2': 'csgo',
  'counter': 'csgo',
  'cs': 'csgo',
  'cs2': 'csgo',
  'cs-go': 'csgo',
  'csgo': 'csgo',
  'dota': 'dota2',
  'dota-2': 'dota2',
  'dota2': 'dota2',
  'ea-sports-fc': 'fifa',
  'fifa': 'fifa',
  'honor': 'kog',
  'honor-of-kings': 'kog',
  'king-of-glory': 'kog',
  'kog': 'kog',
  'league': 'lol',
  'league-of-legends': 'lol',
  'lol': 'lol',
  'lol-wild-rift': 'lol-wild-rift',
  'mobile-legends': 'mlbb',
  'mobile-legends-bang-bang': 'mlbb',
  'mlbb': 'mlbb',
  'overwatch': 'ow',
  'ow': 'ow',
  'pubg': 'pubg',
  'rainbow': 'r6siege',
  'rainbow-six': 'r6siege',
  'rainbow-six-siege': 'r6siege',
  'r6': 'r6siege',
  'r6siege': 'r6siege',
  'rocket-league': 'rl',
  'rl': 'rl',
  'valorant': 'valorant',
  'val': 'valorant',
  'wild-rift': 'lol-wild-rift',
}

const THE_SPORTS_DB_SPORTS: Record<string, string> = {
  'american-football': 'American Football',
  'atp': 'Tennis',
  'atp-doubles': 'Tennis',
  'baseball': 'Baseball',
  'basketball': 'Basketball',
  'bkbbl': 'Basketball',
  'boxing': 'Fighting',
  'cba': 'Basketball',
  'cfl': 'American Football',
  'cricket': 'Cricket',
  'fifa': 'Soccer',
  'football': 'American Football',
  'golf': 'Golf',
  'hockey': 'Ice Hockey',
  'ice-hockey': 'Ice Hockey',
  'international-cricket': 'Cricket',
  'itf': 'Tennis',
  'kbo': 'Baseball',
  'mlb': 'Baseball',
  'mma': 'Fighting',
  'motorsport': 'Motorsport',
  'nba': 'Basketball',
  'nba-summer-league': 'Basketball',
  'ncaa-cbb': 'Basketball',
  'nfl': 'American Football',
  'npb': 'Baseball',
  'pga-tour': 'Golf',
  'power-slap': 'Fighting',
  'rugby': 'Rugby',
  'soccer': 'Soccer',
  'tennis': 'Tennis',
  'ufc': 'Fighting',
  'wimbledon': 'Tennis',
  'wnba': 'Basketball',
  'wta': 'Tennis',
  'wta-doubles': 'Tennis',
}

const THE_SPORTS_DB_SERIES_LEAGUES: Record<string, string> = {
  'cfl': 'CFL',
  'mlb': 'MLB',
  'nba-2026': 'NBA',
  'npb': 'Japanese NPB',
  'soccer-fifwc': 'FIFA World Cup',
  'ufc': 'UFC',
  'wnba': 'WNBA',
}

const THE_SPORTS_DB_DAY_FIRST_SERIES = new Set(['cfl', 'ufc', 'wnba'])

function clampLimit(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)))
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ')?.trim() ?? ''
}

function normalizeDate(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeStringId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || null
  }
  return null
}

function normalizeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.toString() : null
  }
  catch {
    return null
  }
}

function detectLivestreamProvider(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const hostname = new URL(value).hostname
    if (/twitch\.tv$/i.test(hostname)) {
      return 'twitch'
    }
    if (/(?:youtube\.com|youtu\.be)$/i.test(hostname)) {
      return 'youtube'
    }
    return hostname
  }
  catch {
    return null
  }
}

function isPreferredLivestreamUrl(value: string | null) {
  if (!value) {
    return false
  }

  try {
    return YOUTUBE_OR_TWITCH_HOST_PATTERN.test(new URL(value).hostname)
  }
  catch {
    return false
  }
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  return null
}

function normalizeTokenText(value: string | null | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\b(?:united states|u\.?s\.?a\.?|usmnt|uswnt)\b/g, 'usa')
}

function tokenSet(value: string | null | undefined) {
  return new Set(normalizeTokenText(value)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 2 && token !== 'vs'))
}

function tokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) {
    return 0
  }

  let matches = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size)
}

function tokenContainment(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) {
    return 0
  }

  let matches = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1
    }
  }

  return matches / Math.min(leftTokens.size, rightTokens.size)
}

function tokenCoverage(value: string | null | undefined, candidateText: string | null | undefined) {
  const valueTokens = tokenSet(value)
  const candidateTokens = tokenSet(candidateText)
  if (!valueTokens.size || !candidateTokens.size) {
    return 0
  }

  let matches = 0
  for (const token of valueTokens) {
    if (candidateTokens.has(token)) {
      matches += 1
    }
  }

  return matches / valueTokens.size
}

function hasTextualMatch(matchReason: string[]) {
  return matchReason.includes('content') || matchReason.includes('team')
}

function buildCandidateText(candidate: SportsSourceCandidate) {
  return [
    candidate.homeTeam?.name,
    candidate.awayTeam?.name,
    candidate.eventName,
    candidate.leagueName,
    candidate.sportSlug,
  ].filter(Boolean).join(' ')
}

function buildTeamsFromMatchupText(value: string | null | undefined) {
  const matchup = buildSportsSourceMatchupSearchQuery(null, value)
  const teams = matchup
    ?.split(/\s+vs\s+/i)
    .map(team => normalizeTheSportsDbTeamSearchText(team))
    .filter(Boolean) ?? []
  return teams.length >= 2 ? teams.slice(0, 2) : []
}

function buildHintsFromParams(input: SportsSourceSuggestParams): SportsMatchHints {
  const contentParts = [
    input.title,
    input.question,
    input.description,
    input.slug?.replace(/-/g, ' '),
    ...(input.outcomes ?? []),
  ].map(value => normalizeText(value ?? '')).filter(Boolean)

  const query = normalizeText(contentParts.join(' '))
  const rawOutcomeTeams = normalizeText((input.outcomes ?? []).join(' vs ')).split(/\s+(?:vs\.?|v\.?|at|@)\s+/i).filter(Boolean)
  const outcomeTeams = rawOutcomeTeams.length >= 2 ? rawOutcomeTeams : []
  const structuredTeams = (input.teams ?? [])
    .map(team => normalizeText(team.name) || normalizeText(team.abbreviation))
    .filter(Boolean)
  const matchupTeams = [input.title, input.question, input.slug?.replace(/-/g, ' ')]
    .map(buildTeamsFromMatchupText)
    .find(teams => teams.length >= 2) ?? []
  return {
    query,
    teams: structuredTeams.length >= 2
      ? structuredTeams.slice(0, 2)
      : matchupTeams.length >= 2
        ? matchupTeams
        : outcomeTeams,
    sport: normalizeText(input.sport ?? '') || null,
    league: normalizeText(input.league ?? '') || null,
    date: normalizeDate(input.date ?? null),
  }
}

function mergeHints(base: SportsMatchHints, aiHints: Partial<SportsMatchHints> | null): SportsMatchHints {
  if (!aiHints) {
    return base
  }

  return {
    query: normalizeText(aiHints.query ?? '') || base.query,
    teams: base.teams.length >= 2
      ? base.teams
      : Array.isArray(aiHints.teams) && aiHints.teams.length > 0
        ? aiHints.teams.map(team => normalizeText(team)).filter(Boolean)
        : base.teams,
    sport: (base.sport ?? normalizeText(aiHints.sport ?? '')) || null,
    league: (base.league ?? normalizeText(aiHints.league ?? '')) || null,
    date: base.date ?? normalizeDate(aiHints.date ?? null),
  }
}

async function extractHintsWithAi(input: SportsSourceSuggestParams, baseHints: SportsMatchHints) {
  const openRouterSettings = await loadOpenRouterProviderSettings()
  const apiKey = openRouterSettings.apiKey
  const model = openRouterSettings.model || 'openai/gpt-4o-mini'

  if (!apiKey) {
    return baseHints
  }

  try {
    const content = await requestOpenRouterCompletion([
      {
        role: 'system',
        content: 'Extract sports match search hints. Return compact JSON only with keys query, teams, sport, league, date. Do not include creator identity, wallet, or platform origin.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: input.title,
          question: input.question,
          outcomes: input.outcomes,
          teams: input.teams,
          description: input.description,
          slug: input.slug,
          tags: input.tags,
          date: input.date,
        }),
      },
    ], {
      apiKey,
      model,
      temperature: 0,
      maxTokens: 220,
    })

    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content
    const parsed = JSON.parse(jsonText) as Partial<SportsMatchHints>
    return mergeHints(baseHints, parsed)
  }
  catch (error) {
    console.error('Sports match AI hint extraction failed:', error)
    return baseHints
  }
}

function scoreSportsCandidate(
  input: SportsSourceSuggestParams,
  candidate: SportsSourceCandidate,
  hints = buildHintsFromParams(input),
) {
  const reasons: string[] = []
  let score = 0

  const candidateText = buildCandidateText(candidate)
  const eventNameScore = tokenContainment(input.title ?? hints.query, candidate.eventName)
  const contentScore = Math.max(tokenOverlap(hints.query, candidateText), eventNameScore)
  if (contentScore > 0) {
    score += contentScore * 0.45
    reasons.push('content')
  }

  for (const team of hints.teams) {
    const homeScore = tokenOverlap(team, candidate.homeTeam?.name)
    const awayScore = tokenOverlap(team, candidate.awayTeam?.name)
    const eventNameTeamScore = !candidate.homeTeam && !candidate.awayTeam
      ? tokenCoverage(team, candidate.eventName)
      : 0
    const bestTeamScore = Math.max(homeScore, awayScore, eventNameTeamScore)
    if (bestTeamScore > 0) {
      score += Math.min(0.18, bestTeamScore * 0.18)
      reasons.push('team')
    }
  }

  const sportSlug = normalizeSportsIdentity(hints.sport, candidate.provider)
  if (sportSlug && normalizeSportsIdentity(candidate.sportSlug, candidate.provider) === sportSlug) {
    score += 0.12
    reasons.push('sport')
  }

  const leagueSlug = slugifyText(hints.league ?? '')
  if (leagueSlug && candidate.leagueSlug === leagueSlug) {
    score += 0.12
    reasons.push('league')
  }

  const targetDate = hints.date ?? normalizeDate(input.date ?? null)
  if (targetDate && (candidate.eventDate === targetDate || candidate.startTime?.slice(0, 10) === targetDate)) {
    score += 0.13
    reasons.push('date')
  }

  return {
    confidence: Math.min(1, Number(score.toFixed(4))),
    matchReason: Array.from(new Set(reasons)),
  }
}

function normalizeTheSportsDbSearchText(value: string) {
  return normalizeText(value)
    .replace(/\bvs\.\s*/gi, 'vs ')
    .replace(/\bv\.\s*/gi, 'v ')
    .replace(/[?!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTheSportsDbTeamSearchText(value: string) {
  return normalizeTheSportsDbSearchText(value)
    .replace(/^will\s+/i, '')
    .replace(/^(?:can|could|does|do|did|is|are)\s+/i, '')
    .replace(/\s+to\s+(?:win|beat|defeat|draw|tie|qualify|advance|score)\b.*$/i, '')
    .replace(/\s+(?:end|ends|finish|finishes|finished|result|draw|tie)\b.*$/i, '')
    .replace(/\s+(?:win|wins|beat|beats|defeat|defeats|qualify|qualifies|advance|advances)\b.*$/i, '')
    .replace(/\s+win$/i, '')
    .replace(/[.,:;|()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimTheSportsDbMatchupSuffix(value: string) {
  const indexes = [':', '|', ',', ';', '?']
    .map(separator => value.indexOf(separator))
    .filter(index => index >= 0)

  return indexes.length > 0 ? value.slice(0, Math.min(...indexes)) : value
}

function buildTheSportsDbMatchupQuery(value: string) {
  const normalized = normalizeTheSportsDbSearchText(value)
  const parts = normalized.split(' ').filter(Boolean)
  const separatorIndex = parts.findIndex((part, index) => {
    const token = part.toLowerCase()
    return index > 0 && index < parts.length - 1 && (token === 'vs' || token === 'v' || token === 'at' || token === '@')
  })
  if (separatorIndex === -1) {
    return null
  }

  const separator = parts[separatorIndex]?.toLowerCase()
  const left = normalizeTheSportsDbTeamSearchText(parts.slice(0, separatorIndex).join(' '))
  const right = normalizeTheSportsDbTeamSearchText(trimTheSportsDbMatchupSuffix(parts.slice(separatorIndex + 1).join(' ')))
  const home = separator === 'at' || separator === '@' ? right : left
  const away = separator === 'at' || separator === '@' ? left : right
  return home && away ? `${home} vs ${away}` : null
}

function applyTheSportsDbTeamAliases(value: string) {
  return normalizeText(value)
    .replace(/\b(?:United States|U\.?S\.?A\.?|USMNT|USWNT)\b/gi, 'USA')
    .replace(/\.+(?:\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatTheSportsDbFilenameSegment(value: string | null | undefined) {
  const acronyms = new Set(['afc', 'caf', 'cba', 'cfl', 'concacaf', 'fifa', 'kbo', 'mlb', 'mls', 'nba', 'nfl', 'nhl', 'npb', 'uefa', 'ufc', 'wnba'])
  return normalizeText(value)
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      return acronyms.has(lower) ? lower.toUpperCase() : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`
    })
    .join(' ')
}

function buildTheSportsDbFilenameQuery(params: SportsSourceSearchParams, matchup: string | null) {
  const date = normalizeDate(params.date)
  const seriesLeague = THE_SPORTS_DB_SERIES_LEAGUES[slugifyText(params.series ?? '')]
  const league = formatTheSportsDbFilenameSegment(normalizeText(params.league) || seriesLeague)
  return date && league && matchup
    ? applyTheSportsDbTeamAliases(`${league} ${date} ${matchup}`)
    : null
}

function isTheSportsDbLiveStatus(status: string) {
  return /^(?:live|1h|2h|ht|et|bt|p|pen|pens)$/i.test(status) || /^\d+'/.test(status)
}

function isTheSportsDbEndedStatus(status: string) {
  return /^(?:ft|aet|ap|match finished|finished)$/i.test(status) || status.toLowerCase().includes('finished')
}

function chooseBestStream(streams: unknown): {
  livestreamUrl: string | null
  livestreamEmbedUrl: string | null
  livestreamProvider: string | null
  livestreamOfficial: boolean | null
} {
  if (!Array.isArray(streams)) {
    return {
      livestreamUrl: null,
      livestreamEmbedUrl: null,
      livestreamProvider: null,
      livestreamOfficial: null,
    }
  }

  const candidates = streams
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((stream) => {
      const rawUrl = normalizeHttpsUrl(stream.raw_url ?? stream.url)
      const embedUrl = normalizeHttpsUrl(stream.embed_url)
      return {
        rawUrl,
        embedUrl,
        official: normalizeBoolean(stream.official),
        main: normalizeBoolean(stream.main),
        preferred: isPreferredLivestreamUrl(rawUrl) || isPreferredLivestreamUrl(embedUrl),
      }
    })
    .filter(stream => stream.rawUrl || stream.embedUrl)
    .sort((left, right) => {
      const leftScore = (left.main ? 4 : 0) + (left.official ? 3 : 0) + (left.preferred ? 2 : 0)
      const rightScore = (right.main ? 4 : 0) + (right.official ? 3 : 0) + (right.preferred ? 2 : 0)
      return rightScore - leftScore
    })

  const selected = candidates[0]
  const livestreamUrl = selected?.rawUrl ?? selected?.embedUrl ?? null
  return {
    livestreamUrl,
    livestreamEmbedUrl: selected?.embedUrl ?? null,
    livestreamProvider: detectLivestreamProvider(livestreamUrl),
    livestreamOfficial: selected?.official ?? null,
  }
}

function buildScore(homeScore: unknown, awayScore: unknown) {
  const home = normalizeStringId(homeScore)
  const away = normalizeStringId(awayScore)
  return home !== null && away !== null ? `${home}-${away}` : null
}

function resolvePandaScoreVideogameSlug(value: string | null | undefined) {
  const normalized = slugifyText(value ?? '')
  if (!normalized) {
    return null
  }

  if (PANDASCORE_VIDEOGAME_ENDPOINTS[normalized]) {
    return normalized
  }

  const tokenMatch = normalized
    .split('-')
    .map(token => PANDASCORE_VIDEOGAME_ENDPOINTS[token])
    .find(Boolean)

  if (tokenMatch) {
    return Object.entries(PANDASCORE_VIDEOGAME_ENDPOINTS)
      .find(([, endpoint]) => endpoint === tokenMatch)?.[0] ?? null
  }

  if (normalized.includes('valorant')) {
    return 'valorant'
  }
  if (normalized.includes('counter-strike') || normalized.includes('cs2') || normalized.includes('csgo')) {
    return 'csgo'
  }
  if (normalized.includes('league-of-legends')) {
    return 'lol'
  }
  if (normalized.includes('dota')) {
    return 'dota2'
  }
  if (normalized.includes('rocket-league')) {
    return 'rl'
  }

  return null
}

function normalizeSportsIdentity(value: string | null | undefined, provider: SportsSourceProvider) {
  if (provider === 'pandascore') {
    const pandaScoreSlug = resolvePandaScoreVideogameSlug(value)
    return pandaScoreSlug ? PANDASCORE_VIDEOGAME_ENDPOINTS[pandaScoreSlug] : slugifyText(value ?? '')
  }

  return slugifyText(formatTheSportsDbSportParam(value) ?? '')
}

function buildPandaScoreMatchesUrl(pathname: string, limit: number) {
  const url = new URL(`https://api.pandascore.co${pathname}`)
  url.searchParams.set('per_page', String(limit))
  return url
}

function appendPandaScoreDateRange(url: URL, date: string | null) {
  if (!date) {
    return
  }

  url.searchParams.set('range[begin_at]', `${date}T00:00:00Z,${date}T23:59:59Z`)
  url.searchParams.set('sort', 'begin_at')
}

function normalizePandaScoreMatchupQuery(value: string | null | undefined) {
  return buildSportsSourceMatchupSearchQuery(null, value) || normalizeText(value)
}

function buildPandaScoreSearchUrl(params: SportsSourceSearchParams) {
  const q = normalizePandaScoreMatchupQuery(params.q)
  const date = normalizeDate(params.date)
  const videogameSlug = resolvePandaScoreVideogameSlug(params.sport) ?? resolvePandaScoreVideogameSlug(q)
  const videogameEndpoint = videogameSlug ? PANDASCORE_VIDEOGAME_ENDPOINTS[videogameSlug] : null
  const pathname = videogameEndpoint ? `/${videogameEndpoint}/matches` : '/matches'
  const url = buildPandaScoreMatchesUrl(
    pathname,
    date ? PANDASCORE_DATE_SEARCH_LIMIT : clampLimit(params.limit),
  )

  if (date) {
    appendPandaScoreDateRange(url, date)
  }
  else if (q) {
    url.searchParams.set('search[name]', q)
  }

  return url
}

async function fetchJson(url: URL, headers?: HeadersInit) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Sports provider request failed: ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

function normalizePandaScoreMatch(raw: Record<string, unknown>): SportsSourceCandidate | null {
  const eventId = normalizeStringId(raw.id)
  if (!eventId) {
    return null
  }

  const opponents = Array.isArray(raw.opponents) ? raw.opponents : []
  const normalizedOpponents = opponents
    .map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item, index) => {
      const opponent = item.opponent && typeof item.opponent === 'object' && !Array.isArray(item.opponent)
        ? item.opponent as Record<string, unknown>
        : item
      const name = normalizeText(String(opponent.name ?? ''))
      return {
        name,
        abbreviation: normalizeStringId(opponent.acronym),
        slug: normalizeText(String(opponent.slug ?? '')) || slugifyText(name),
        logo: normalizeHttpsUrl(opponent.image_url),
        hostStatus: index === 0 ? 'home' as const : 'away' as const,
      }
    })
    .filter(team => team.name)

  const league = raw.league && typeof raw.league === 'object' && !Array.isArray(raw.league)
    ? raw.league as Record<string, unknown>
    : null
  const videogame = raw.videogame && typeof raw.videogame === 'object' && !Array.isArray(raw.videogame)
    ? raw.videogame as Record<string, unknown>
    : null
  const results = Array.isArray(raw.results) ? raw.results : []
  const homeResult = results[0] && typeof results[0] === 'object' ? results[0] as Record<string, unknown> : null
  const awayResult = results[1] && typeof results[1] === 'object' ? results[1] as Record<string, unknown> : null
  const stream = chooseBestStream(raw.streams_list)
  const status = normalizeText(String(raw.status ?? '')).toLowerCase()

  return {
    provider: 'pandascore',
    eventId,
    eventName: normalizeText(String(raw.name ?? '')) || null,
    gameId: null,
    leagueId: normalizeStringId(league?.id),
    leagueName: normalizeText(String(league?.name ?? '')) || null,
    leagueSlug: normalizeText(String(league?.slug ?? '')) || null,
    sportSlug: normalizeText(String(videogame?.slug ?? '')) || null,
    eventDate: normalizeDate(normalizeText(String(raw.begin_at ?? ''))),
    startTime: normalizeIso(raw.begin_at),
    homeTeam: normalizedOpponents[0] ?? null,
    awayTeam: normalizedOpponents[1] ?? null,
    score: buildScore(homeResult?.score, awayResult?.score),
    period: status || null,
    elapsed: null,
    live: status === 'running',
    ended: status === 'finished',
    ...stream,
    confidence: 0,
    matchReason: [],
    raw,
  }
}

async function searchPandaScore(params: SportsSourceSearchParams): Promise<SportsSourceCandidate[]> {
  const token = params.auth?.pandascoreToken?.trim()
  if (!token) {
    return []
  }

  const payload = await fetchJson(buildPandaScoreSearchUrl(params), { Authorization: `Bearer ${token}` })
  return (Array.isArray(payload) ? payload : [])
    .map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? normalizePandaScoreMatch(item as Record<string, unknown>) : null)
    .filter((item): item is SportsSourceCandidate => Boolean(item))
}

async function resolvePandaScore(params: SportsSourceResolveParams): Promise<SportsSourceCandidate | null> {
  const token = params.auth?.pandascoreToken?.trim()
  const id = normalizeStringId(params.eventId ?? params.gameId)
  if (!token || !id) {
    return null
  }

  const url = new URL(`https://api.pandascore.co/matches/${encodeURIComponent(id)}`)
  const payload = await fetchJson(url, { Authorization: `Bearer ${token}` })
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? normalizePandaScoreMatch(payload as Record<string, unknown>)
    : null
}

function normalizeTheSportsDbEvent(raw: Record<string, unknown>): SportsSourceCandidate | null {
  const eventId = normalizeStringId(raw.idEvent)
  if (!eventId) {
    return null
  }

  const homeName = normalizeText(String(raw.strHomeTeam ?? ''))
  const awayName = normalizeText(String(raw.strAwayTeam ?? ''))
  const rawTimestamp = normalizeText(String(raw.strTimestamp ?? ''))
  const timestamp = rawTimestamp && !/(?:z|[+-]\d{2}:?\d{2})$/i.test(rawTimestamp)
    ? `${rawTimestamp}Z`
    : rawTimestamp
  const startTime = normalizeIso(timestamp)
    ?? normalizeIso(`${normalizeText(String(raw.dateEvent ?? ''))}T${normalizeText(String(raw.strTime ?? '00:00:00'))}Z`)
  const status = normalizeText(String(raw.strStatus ?? ''))
  const ended = isTheSportsDbEndedStatus(status)
  const stream = chooseBestStream([
    raw.strLiveStream ? { raw_url: raw.strLiveStream, official: true, main: true } : null,
    raw.strStream ? { raw_url: raw.strStream, official: true, main: true } : null,
    raw.strYoutube ? { raw_url: raw.strYoutube, official: true, main: false } : null,
    raw.strTwitch ? { raw_url: raw.strTwitch, official: true, main: false } : null,
  ].filter(Boolean))

  return {
    provider: 'thesportsdb',
    eventId,
    eventName: normalizeText(String(raw.strEvent ?? '')) || null,
    gameId: null,
    leagueId: normalizeStringId(raw.idLeague),
    leagueName: normalizeText(String(raw.strLeague ?? '')) || null,
    leagueSlug: slugifyText(String(raw.strLeague ?? '')) || null,
    sportSlug: slugifyText(String(raw.strSport ?? '')) || null,
    eventDate: normalizeDate(normalizeText(String(raw.dateEvent ?? ''))),
    startTime,
    homeTeam: homeName ? { name: homeName, slug: slugifyText(homeName), hostStatus: 'home' } : null,
    awayTeam: awayName ? { name: awayName, slug: slugifyText(awayName), hostStatus: 'away' } : null,
    score: buildScore(raw.intHomeScore, raw.intAwayScore),
    period: status || null,
    elapsed: null,
    live: ended ? false : isTheSportsDbLiveStatus(status) ? true : null,
    ended: ended ? true : null,
    ...stream,
    confidence: 0,
    matchReason: [],
    raw,
  }
}

function readTheSportsDbEvents(payload: unknown, limit: number) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }

  const record = payload as Record<string, unknown>
  const events = Array.isArray(record.event)
    ? record.event
    : Array.isArray(record.events)
      ? record.events
      : []

  return events
    .slice(0, limit)
    .map(item => (item && typeof item === 'object' && !Array.isArray(item)) ? normalizeTheSportsDbEvent(item as Record<string, unknown>) : null)
    .filter((item): item is SportsSourceCandidate => Boolean(item))
}

function candidateMatchesDate(candidate: SportsSourceCandidate, date: string) {
  return candidate.eventDate === date || candidate.startTime?.slice(0, 10) === date
}

function formatTheSportsDbSportParam(value: string | null | undefined) {
  const normalized = slugifyText(value ?? '')
  if (!normalized) {
    return null
  }

  return THE_SPORTS_DB_SPORTS[normalized] ?? normalized
    .split('-')
    .map(part => part ? `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}` : '')
    .join(' ')
}

async function searchTheSportsDb(params: SportsSourceSearchParams): Promise<SportsSourceCandidate[]> {
  const key = params.auth?.theSportsDbApiKey?.trim()
  const q = normalizeText(params.q)
  if (!key || !q) {
    return []
  }
  const apiKey = key

  const limit = clampLimit(params.limit)
  const date = normalizeDate(params.date)
  const sport = formatTheSportsDbSportParam(params.sport)
  const matchup = buildTheSportsDbMatchupQuery(q)
  const series = slugifyText(params.series ?? '')
  const eventQuery = applyTheSportsDbTeamAliases(matchup ?? normalizeTheSportsDbSearchText(q))

  async function searchDay() {
    if (!date) {
      return []
    }
    const dayUrl = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/eventsday.php`)
    dayUrl.searchParams.set('d', date)
    if (sport) {
      dayUrl.searchParams.set('s', sport)
    }
    return readTheSportsDbEvents(await fetchJson(dayUrl), Math.max(limit, THE_SPORTS_DB_FALLBACK_LIMIT))
  }

  if (date && (sport === 'Fighting' || THE_SPORTS_DB_DAY_FIRST_SERIES.has(series))) {
    return (await searchDay()).filter(candidate => candidateMatchesDate(candidate, date))
  }

  const filenameQuery = buildTheSportsDbFilenameQuery(params, matchup)
  const searchUrl = filenameQuery
    ? new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchfilename.php`)
    : new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchevents.php`)
  searchUrl.searchParams.set('e', filenameQuery ?? eventQuery)

  let primaryCandidates: SportsSourceCandidate[] = []
  try {
    primaryCandidates = readTheSportsDbEvents(await fetchJson(searchUrl), limit)
  }
  catch (error) {
    if (!date) {
      throw error
    }
    console.error('TheSportsDB primary search failed:', error)
  }

  if (!date) {
    return primaryCandidates
  }

  const datedPrimaryCandidates = primaryCandidates.filter(candidate => candidateMatchesDate(candidate, date))
  if (datedPrimaryCandidates.length > 0) {
    return datedPrimaryCandidates
  }

  if (filenameQuery) {
    const eventUrl = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchevents.php`)
    eventUrl.searchParams.set('e', eventQuery)
    const eventCandidates = readTheSportsDbEvents(await fetchJson(eventUrl), limit)
    return eventCandidates.filter(candidate => candidateMatchesDate(candidate, date))
  }

  return (await searchDay()).filter(candidate => candidateMatchesDate(candidate, date))
}

async function resolveTheSportsDb(params: SportsSourceResolveParams): Promise<SportsSourceCandidate | null> {
  const key = params.auth?.theSportsDbApiKey?.trim()
  const id = normalizeStringId(params.eventId ?? params.gameId)
  if (!key || !id) {
    return null
  }

  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/lookupevent.php`)
  url.searchParams.set('id', id)
  const payload = await fetchJson(url)
  const events = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).events
    : null
  const first = Array.isArray(events) ? events[0] : null
  return first && typeof first === 'object' && !Array.isArray(first)
    ? normalizeTheSportsDbEvent(first as Record<string, unknown>)
    : null
}

function providerList(provider?: string | null, auth?: SportsSourceAuth | null): SportsSourceProvider[] {
  const hasExplicitProvider = Boolean(provider?.trim())
  const providers = normalizeSportsSourceProviderTokens(provider)
  const requestedProviders = providers.length > 0
    ? providers
    : hasExplicitProvider
      ? []
      : [...DEFAULT_SPORTS_SOURCE_PROVIDER_ORDER]
  const configuredProviders = auth ? getConfiguredSportsSourceProviders(auth) : []

  return configuredProviders.length > 0
    ? requestedProviders.filter(provider => configuredProviders.includes(provider))
    : requestedProviders
}

async function runProviderSearch(provider: SportsSourceProvider, params: SportsSourceSearchParams) {
  switch (provider) {
    case 'pandascore':
      return searchPandaScore(params)
    case 'thesportsdb':
      return searchTheSportsDb(params)
  }
}

async function runProviderResolve(provider: SportsSourceProvider, params: SportsSourceResolveParams) {
  switch (provider) {
    case 'pandascore':
      return resolvePandaScore(params)
    case 'thesportsdb':
      return resolveTheSportsDb(params)
  }
}

export async function searchSportsEvents(params: SportsSourceSearchParams) {
  const providers = providerList(params.provider, params.auth)
  const results = await Promise.allSettled(providers.map(provider => runProviderSearch(provider, params)))
  return results
    .flatMap((result) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      console.error('Sports provider search failed:', result.reason)
      return []
    })
    .map((candidate) => {
      const scored = scoreSportsCandidate({
        title: params.q ?? '',
        sport: params.sport,
        league: params.league,
        date: params.date,
      }, candidate)
      return {
        ...candidate,
        confidence: scored.confidence,
        matchReason: scored.matchReason,
      }
    })
    .filter(candidate => !normalizeText(params.q) || hasTextualMatch(candidate.matchReason))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, clampLimit(params.limit))
}

export async function resolveSportsEvent(params: SportsSourceResolveParams) {
  const providers = providerList(params.provider, params.auth)
  for (const provider of providers) {
    try {
      const candidate = await runProviderResolve(provider, params)
      if (candidate) {
        return candidate
      }
    }
    catch (error) {
      console.error('Sports provider resolve failed:', error)
    }
  }

  return null
}

export async function findSportsEvents(params: SportsSourceSuggestParams) {
  const limit = clampLimit(params.limit)
  const baseHints = buildHintsFromParams(params)
  const hints = await extractHintsWithAi(params, baseHints)
  const query = hints.query || normalizeText(params.title ?? params.question ?? '')
  if (!query) {
    return []
  }
  const searchQuery = hints.teams.length >= 2
    ? `${hints.teams[0]} vs ${hints.teams[1]}`
    : query

  const candidates = await searchSportsEvents({
    q: searchQuery,
    sport: hints.sport ?? params.sport,
    league: hints.league ?? params.league,
    series: params.series,
    date: hints.date ?? params.date,
    category: params.category,
    tags: params.tags,
    provider: params.provider,
    limit,
    auth: params.auth,
  })

  return candidates
    .map((candidate) => {
      const scored = scoreSportsCandidate(params, candidate, hints)
      return {
        ...candidate,
        confidence: scored.confidence,
        matchReason: scored.matchReason,
      }
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, limit)
}
