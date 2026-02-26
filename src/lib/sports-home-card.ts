import type { Event, Market, Outcome, SportsTeam } from '@/types'

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash) ? withHash : null
}

function hasSportsContext(event: Event) {
  return Boolean(event.sports_sport_slug?.trim())
}

function getNormalizedEventTagTokens(event: Event) {
  const tagTokens = new Set<string>()

  for (const tag of event.tags ?? []) {
    const normalizedSlug = normalizeText(tag.slug)
    const normalizedName = normalizeText(tag.name)
    if (normalizedSlug) {
      tagTokens.add(normalizedSlug)
    }
    if (normalizedName) {
      tagTokens.add(normalizedName)
    }
  }

  const normalizedMainTag = normalizeText(event.main_tag)
  if (normalizedMainTag) {
    tagTokens.add(normalizedMainTag)
  }

  return tagTokens
}

function hasPropsTag(event: Event) {
  const tagTokens = getNormalizedEventTagTokens(event)
  return Array.from(tagTokens).some(token => token === 'props' || token === 'prop')
}

function hasGamesTag(event: Event) {
  const tagTokens = getNormalizedEventTagTokens(event)
  return Array.from(tagTokens).some(token => token === 'games' || token === 'game')
}

function isNegRiskEvent(event: Event) {
  return Boolean(
    event.neg_risk
    || event.enable_neg_risk
    || event.neg_risk_augmented
    || event.neg_risk_market_id,
  )
}

function marketDisplayText(market: Market) {
  return [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ].join(' ')
}

function isDrawMarket(market: Market) {
  return normalizeText(marketDisplayText(market)).includes('draw')
}

function doesTextMatchTeam(value: string | null | undefined, team: HomeSportsTeam | null) {
  if (!value || !team) {
    return false
  }

  const haystack = normalizeText(value)
  if (!haystack) {
    return false
  }

  const normalizedName = normalizeText(team.name)
  if (normalizedName && haystack.includes(normalizedName)) {
    return true
  }

  const normalizedAbbreviation = normalizeText(team.abbreviation)
  if (!normalizedAbbreviation) {
    return false
  }

  const haystackTokens = new Set(haystack.split(' ').filter(Boolean))
  return haystackTokens.has(normalizedAbbreviation)
}

function doesMarketMatchTeam(market: Market, team: HomeSportsTeam | null) {
  if (!team || isDrawMarket(market)) {
    return false
  }

  return doesTextMatchTeam(marketDisplayText(market), team)
}

function resolveYesOutcome(market: Market) {
  return market.outcomes.find(outcome => normalizeText(outcome.outcome_text) === 'yes')
    ?? market.outcomes.find(outcome => outcome.outcome_index === 0)
    ?? market.outcomes[0]
    ?? null
}

function toMarketType(market: Market) {
  const normalizedType = normalizeText(market.sports_market_type)
  if (
    normalizedType.includes('moneyline')
    || normalizedType.includes('match winner')
    || normalizedType === '1x2'
  ) {
    return 'moneyline' as const
  }

  return null
}

function buildFallbackAbbreviation(teamName: string) {
  return teamName
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
}

function toHomeSportsTeams(event: Event): HomeSportsTeam[] {
  const logoUrls = event.sports_team_logo_urls ?? []
  const rawTeams = (event.sports_teams ?? []) as SportsTeam[]
  const teams = rawTeams
    .map((team, index): HomeSportsTeam | null => {
      const name = team.name?.trim() ?? ''
      if (!name) {
        return null
      }

      const abbreviation = team.abbreviation?.trim() || buildFallbackAbbreviation(name)
      const logoUrl = team.logo_url?.trim() || logoUrls[index] || null

      return {
        name,
        abbreviation,
        color: normalizeHexColor(team.color),
        logoUrl,
        hostStatus: team.host_status?.trim() ?? null,
      }
    })
    .filter((team): team is HomeSportsTeam => Boolean(team))

  return teams.sort((a, b) => {
    if (a.hostStatus === 'home' && b.hostStatus !== 'home') {
      return -1
    }
    if (b.hostStatus === 'home' && a.hostStatus !== 'home') {
      return 1
    }
    if (a.hostStatus === 'away' && b.hostStatus !== 'away') {
      return 1
    }
    if (b.hostStatus === 'away' && a.hostStatus !== 'away') {
      return -1
    }
    return 0
  })
}

function resolvePrimaryTeams(teams: HomeSportsTeam[]) {
  const homeTeam = teams.find(team => team.hostStatus === 'home') ?? null
  const awayTeam = teams.find(team => team.hostStatus === 'away') ?? null
  const team1 = homeTeam ?? teams[0] ?? null
  const team2 = awayTeam ?? teams.find(team => team !== team1) ?? null
  return { team1, team2 }
}

function toHomeButton(payload: {
  market: Market
  outcome: Outcome
  label: string
  tone: 'team1' | 'team2' | 'draw'
  color: string | null
}) {
  return {
    conditionId: payload.market.condition_id,
    outcomeIndex: payload.outcome.outcome_index,
    label: payload.label,
    tone: payload.tone,
    color: payload.color,
  }
}

function findMoneylineMarkets(event: Event) {
  return (event.markets ?? []).filter((market) => {
    if (!market?.condition_id) {
      return false
    }

    if (toMarketType(market) === 'moneyline') {
      return true
    }

    return isDrawMarket(market)
  })
}

export interface HomeSportsTeam {
  name: string
  abbreviation: string
  color: string | null
  logoUrl: string | null
  hostStatus: string | null
}

export interface HomeSportsMoneylineButton {
  conditionId: string
  outcomeIndex: number
  label: string
  tone: 'team1' | 'team2' | 'draw'
  color: string | null
}

export interface HomeSportsMoneylineModel {
  team1: HomeSportsTeam
  team2: HomeSportsTeam
  team1Button: HomeSportsMoneylineButton
  team2Button: HomeSportsMoneylineButton
  drawButton?: HomeSportsMoneylineButton
}

export function buildHomeSportsMoneylineModel(event: Event): HomeSportsMoneylineModel | null {
  if (
    !hasSportsContext(event)
    || hasPropsTag(event)
    || !hasGamesTag(event)
    || !isNegRiskEvent(event)
  ) {
    return null
  }

  const teams = toHomeSportsTeams(event)
  const { team1, team2 } = resolvePrimaryTeams(teams)

  if (!team1 || !team2) {
    return null
  }

  const moneylineMarkets = findMoneylineMarkets(event)
  if (moneylineMarkets.length < 2) {
    return null
  }

  const drawMarket = moneylineMarkets.find(market => isDrawMarket(market))
  const nonDrawMarkets = moneylineMarkets.filter(market => !isDrawMarket(market))

  const team1Market = nonDrawMarkets.find(market => doesMarketMatchTeam(market, team1))
    ?? nonDrawMarkets[0]
  const team2Market = nonDrawMarkets.find(market => market !== team1Market && doesMarketMatchTeam(market, team2))
    ?? nonDrawMarkets.find(market => market !== team1Market)

  const team1Outcome = team1Market ? resolveYesOutcome(team1Market) : null
  const team2Outcome = team2Market ? resolveYesOutcome(team2Market) : null
  const drawOutcome = drawMarket ? resolveYesOutcome(drawMarket) : null

  if (!team1Market || !team2Market || !team1Outcome || !team2Outcome) {
    return null
  }

  const team1Button = toHomeButton({
    market: team1Market,
    outcome: team1Outcome,
    label: team1.abbreviation,
    tone: 'team1',
    color: team1.color,
  })

  const team2Button = toHomeButton({
    market: team2Market,
    outcome: team2Outcome,
    label: team2.abbreviation,
    tone: 'team2',
    color: team2.color,
  })

  return {
    team1,
    team2,
    team1Button,
    team2Button,
    drawButton: drawMarket && drawOutcome
      ? toHomeButton({
          market: drawMarket,
          outcome: drawOutcome,
          label: 'DRAW',
          tone: 'draw',
          color: null,
        })
      : undefined,
  }
}
