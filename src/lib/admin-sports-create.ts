import {
  getAdminSportsMarketTypeDefaultOutcomes,
  resolveAdminSportsMarketTypeOption,
} from './admin-sports-market-types'
import { normalizeDateTimeLocalValue } from './datetime-local'

export type AdminSportsSection = 'games' | 'props'
export type AdminSportsEventVariant = 'standard' | 'more_markets' | 'exact_score' | 'halftime_result' | 'custom'
export type AdminSportsTeamHostStatus = 'home' | 'away'
export type AdminSportsPropStatType = 'points' | 'rebounds' | 'assists' | 'receiving_yards' | 'rushing_yards'
export type AdminSportsIconAssetKey = '' | AdminSportsTeamHostStatus

export interface AdminSportsTeamState {
  hostStatus: AdminSportsTeamHostStatus
  name: string
  abbreviation: string
}

export interface AdminSportsPropState {
  id: string
  playerName: string
  statType: '' | AdminSportsPropStatType
  line: string
  teamHostStatus: '' | AdminSportsTeamHostStatus
}

export interface AdminSportsCustomMarketState {
  id: string
  sportsMarketType: string
  question: string
  title: string
  shortName: string
  slug: string
  outcomeOne: string
  outcomeTwo: string
  line: string
  groupItemTitle: string
  iconAssetKey: AdminSportsIconAssetKey
}

export interface AdminSportsFormState {
  section: '' | AdminSportsSection
  eventVariant: '' | AdminSportsEventVariant
  sportSlug: string
  leagueSlug: string
  startTime: string
  includeDraw: boolean
  includeBothTeamsToScore: boolean
  includeSpreads: boolean
  includeTotals: boolean
  teams: [AdminSportsTeamState, AdminSportsTeamState]
  props: AdminSportsPropState[]
  customMarkets: AdminSportsCustomMarketState[]
}

export interface AdminSportsPreparePayload {
  section: AdminSportsSection
  eventVariant: AdminSportsEventVariant
  sportSlug?: string
  leagueSlug?: string
  eventDate?: string
  startTime?: string
  teams?: Array<{
    name: string
    abbreviation?: string
    host_status: AdminSportsTeamHostStatus
  }>
  template: {
    includeDraw: boolean
    includeBothTeamsToScore: boolean
    includeSpreads: boolean
    includeTotals: boolean
    spreadLines: number[]
    totalLines: number[]
  }
  props: Array<{
    id: string
    playerName: string
    statType: AdminSportsPropStatType
    line: number
    teamHostStatus?: AdminSportsTeamHostStatus
  }>
  markets: Array<{
    id: string
    question: string
    title: string
    shortName: string
    slug: string
    outcomes: [string, string]
    sportsMarketType: string
    line?: number
    groupItemTitle?: string
    groupItemThreshold?: string
    iconAssetKey?: AdminSportsTeamHostStatus
  }>
}

export interface SportsDerivedCategory {
  label: string
  slug: string
}

export interface SportsDerivedOption {
  id: string
  question: string
  title: string
  shortName: string
  slug: string
  outcomeYes: string
  outcomeNo: string
}

export interface AdminSportsDerivedContent {
  eventSlug: string
  categories: SportsDerivedCategory[]
  options: SportsDerivedOption[]
  payload: AdminSportsPreparePayload | null
}

const SOCCER_MORE_MARKETS_TOTAL_LINES = [1.5, 2.5, 3.5, 4.5]
const SOCCER_MORE_MARKETS_SPREAD_LINES = [1.5]
const EXACT_SCORE_GRID = Array.from({ length: 4 }, (_, homeScore) =>
  Array.from({ length: 4 }, (_, awayScore) => ({ homeScore, awayScore })))
  .flat()

const SPORTS_VARIANT_SUFFIX_BY_KEY: Record<Exclude<AdminSportsEventVariant, 'standard'>, string> = {
  more_markets: 'more-markets',
  exact_score: 'exact-score',
  halftime_result: 'halftime-result',
  custom: 'custom-markets',
}

export function createAdminSportsProp(id: string): AdminSportsPropState {
  return {
    id,
    playerName: '',
    statType: '',
    line: '',
    teamHostStatus: '',
  }
}

export function createAdminSportsCustomMarket(id: string): AdminSportsCustomMarketState {
  return {
    id,
    sportsMarketType: '',
    question: '',
    title: '',
    shortName: '',
    slug: '',
    outcomeOne: '',
    outcomeTwo: '',
    line: '',
    groupItemTitle: '',
    iconAssetKey: '',
  }
}

export function createInitialAdminSportsForm(): AdminSportsFormState {
  return {
    section: '',
    eventVariant: '',
    sportSlug: '',
    leagueSlug: '',
    startTime: '',
    includeDraw: false,
    includeBothTeamsToScore: true,
    includeSpreads: true,
    includeTotals: true,
    teams: [
      {
        hostStatus: 'home',
        name: '',
        abbreviation: '',
      },
      {
        hostStatus: 'away',
        name: '',
        abbreviation: '',
      },
    ],
    props: [createAdminSportsProp('prop-1')],
    customMarkets: [createAdminSportsCustomMarket('market-1')],
  }
}

export function isSportsMainCategory(mainCategorySlug: string) {
  return mainCategorySlug.trim().toLowerCase() === 'sports'
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function trimNumericString(value: number) {
  return Number.parseFloat(value.toFixed(4)).toString()
}

function formatLineSlug(value: number) {
  return trimNumericString(Math.abs(value)).replace('.', 'pt')
}

function formatLineLabel(value: number) {
  return trimNumericString(value)
}

function parseStartTime(value: string) {
  const normalized = normalizeDateTimeLocalValue(value)
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  const hours = Number.parseInt(match[4], 10)
  const minutes = Number.parseInt(match[5], 10)

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
    || parsed.getHours() !== hours
    || parsed.getMinutes() !== minutes
  ) {
    return null
  }

  return {
    date: parsed,
    normalized,
  }
}

function normalizeLineInput(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Number.parseFloat(parsed.toFixed(4))
}

function normalizeSignedLineInput(value: string) {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Number.parseFloat(parsed.toFixed(4))
}

function normalizeSportsMarketType(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function slugifySportsMarketType(value: string) {
  return slugify(value.replace(/_/g, ' '))
}

function buildEventDateFromStartTime(startTime: string) {
  const parsed = parseStartTime(startTime)
  return parsed ? parsed.normalized.slice(0, 10) : ''
}

function buildStartTimeIso(startTime: string) {
  const parsed = parseStartTime(startTime)
  return parsed ? parsed.date.toISOString() : ''
}

function buildSportVariantSlug(section: AdminSportsSection, eventVariant: AdminSportsEventVariant, options: SportsDerivedOption[]) {
  if (eventVariant === 'custom') {
    return 'custom-markets'
  }

  if (section === 'props') {
    return options.some(option => option.slug.startsWith('points-'))
      ? 'player-props'
      : 'player-props'
  }

  if (eventVariant === 'standard') {
    return 'moneyline'
  }

  return SPORTS_VARIANT_SUFFIX_BY_KEY[eventVariant]
}

function buildTeamPair(teams: AdminSportsFormState['teams']) {
  const homeTeam = teams.find(team => team.hostStatus === 'home')
  const awayTeam = teams.find(team => team.hostStatus === 'away')

  return {
    homeTeam,
    awayTeam,
  }
}

export function buildSportsEventSlug(baseSlug: string, eventVariant: AdminSportsFormState['eventVariant']) {
  const normalizedBaseSlug = slugify(baseSlug)
  if (!normalizedBaseSlug) {
    return ''
  }

  if (!eventVariant || eventVariant === 'standard') {
    return normalizedBaseSlug
  }

  return `${normalizedBaseSlug}-${SPORTS_VARIANT_SUFFIX_BY_KEY[eventVariant]}`
}

function createOption(input: Omit<SportsDerivedOption, 'outcomeYes' | 'outcomeNo'> & {
  outcomeYes?: string
  outcomeNo?: string
}): SportsDerivedOption {
  return {
    ...input,
    outcomeYes: input.outcomeYes ?? 'Yes',
    outcomeNo: input.outcomeNo ?? 'No',
  }
}

function buildMoneylineOptions(form: AdminSportsFormState, eventDate: string): SportsDerivedOption[] {
  const { homeTeam, awayTeam } = buildTeamPair(form.teams)
  const homeName = normalizeText(homeTeam?.name ?? '')
  const awayName = normalizeText(awayTeam?.name ?? '')
  if (!homeName || !awayName || !eventDate) {
    return []
  }

  const options: SportsDerivedOption[] = [
    createOption({
      id: 'moneyline-home',
      question: `Will ${homeName} win on ${eventDate}?`,
      title: homeName,
      shortName: homeName,
      slug: slugify(homeName),
    }),
    createOption({
      id: 'moneyline-away',
      question: `Will ${awayName} win on ${eventDate}?`,
      title: awayName,
      shortName: awayName,
      slug: slugify(awayName),
    }),
  ]

  if (form.includeDraw) {
    options.splice(1, 0, createOption({
      id: 'moneyline-draw',
      question: `Will ${homeName} vs. ${awayName} end in a draw?`,
      title: 'Draw',
      shortName: 'Draw',
      slug: 'draw',
    }))
  }

  return options
}

function buildGameOptions(form: AdminSportsFormState, eventDate: string): SportsDerivedOption[] {
  const { homeTeam, awayTeam } = buildTeamPair(form.teams)
  const homeName = normalizeText(homeTeam?.name ?? '')
  const awayName = normalizeText(awayTeam?.name ?? '')
  if (!homeName || !awayName || !eventDate) {
    return []
  }

  const moneylineOptions = buildMoneylineOptions(form, eventDate)

  if (form.eventVariant === 'more_markets') {
    const options: SportsDerivedOption[] = [...moneylineOptions]

    if (form.includeBothTeamsToScore) {
      options.push(createOption({
        id: 'btts',
        question: `${homeName} vs. ${awayName}: Both Teams to Score`,
        title: 'Both Teams to Score',
        shortName: 'Both Teams to Score',
        slug: 'btts',
      }))
    }

    if (form.includeTotals) {
      SOCCER_MORE_MARKETS_TOTAL_LINES.forEach((line) => {
        const lineLabel = formatLineLabel(line)
        options.push(createOption({
          id: `total-${formatLineSlug(line)}`,
          question: `${homeName} vs. ${awayName}: O/U ${lineLabel}`,
          title: `O/U ${lineLabel}`,
          shortName: `O/U ${lineLabel}`,
          slug: `total-${formatLineSlug(line)}`,
          outcomeYes: 'Over',
          outcomeNo: 'Under',
        }))
      })
    }

    if (form.includeSpreads) {
      SOCCER_MORE_MARKETS_SPREAD_LINES.forEach((line) => {
        const lineLabel = `-${formatLineLabel(line)}`
        options.push(createOption({
          id: `spread-home-${formatLineSlug(line)}`,
          question: `Spread: ${homeName} (${lineLabel})`,
          title: `${homeName} (${lineLabel})`,
          shortName: `${homeName} (${lineLabel})`,
          slug: `spread-home-${formatLineSlug(line)}`,
          outcomeYes: homeName,
          outcomeNo: awayName,
        }))
        options.push(createOption({
          id: `spread-away-${formatLineSlug(line)}`,
          question: `Spread: ${awayName} (${lineLabel})`,
          title: `${awayName} (${lineLabel})`,
          shortName: `${awayName} (${lineLabel})`,
          slug: `spread-away-${formatLineSlug(line)}`,
          outcomeYes: awayName,
          outcomeNo: homeName,
        }))
      })
    }

    return options
  }

  if (form.eventVariant === 'exact_score') {
    const options = [
      ...moneylineOptions,
      ...EXACT_SCORE_GRID.map(({ homeScore, awayScore }) => createOption({
        id: `exact-score-${homeScore}-${awayScore}`,
        question: `Exact Score: ${homeName} ${homeScore} - ${awayScore} ${awayName}?`,
        title: `Exact Score: ${homeScore}-${awayScore}`,
        shortName: `Exact Score: ${homeScore}-${awayScore}`,
        slug: `exact-score-${homeScore}-${awayScore}`,
      })),
    ]

    options.push(createOption({
      id: 'exact-score-any-other',
      question: 'Exact Score: Any Other Score?',
      title: 'Exact Score: Any Other Score',
      shortName: 'Exact Score: Any Other Score',
      slug: 'exact-score-any-other',
    }))

    return options
  }

  if (form.eventVariant === 'halftime_result') {
    return [
      ...moneylineOptions,
      createOption({
        id: 'halftime-result-home',
        question: `${homeName} leading at halftime?`,
        title: homeName,
        shortName: homeName,
        slug: 'halftime-result-home',
      }),
      createOption({
        id: 'halftime-result-draw',
        question: `${homeName} vs. ${awayName}: Draw at halftime?`,
        title: 'Draw',
        shortName: 'Draw',
        slug: 'halftime-result-draw',
      }),
      createOption({
        id: 'halftime-result-away',
        question: `${awayName} leading at halftime?`,
        title: awayName,
        shortName: awayName,
        slug: 'halftime-result-away',
      }),
    ]
  }

  return moneylineOptions
}

function buildPropLabel(statType: AdminSportsPropStatType) {
  switch (statType) {
    case 'points':
      return 'Points'
    case 'rebounds':
      return 'Rebounds'
    case 'assists':
      return 'Assists'
    case 'receiving_yards':
      return 'Receiving Yards'
    case 'rushing_yards':
      return 'Rushing Yards'
  }
}

function buildPropOptions(form: AdminSportsFormState) {
  return form.props.flatMap((prop) => {
    const playerName = normalizeText(prop.playerName)
    const line = normalizeLineInput(prop.line)
    if (!playerName || !prop.statType || line === null) {
      return []
    }

    const lineLabel = formatLineLabel(line)
    const statLabel = buildPropLabel(prop.statType)

    return [
      createOption({
        id: prop.id,
        question: `${playerName}: ${statLabel} O/U ${lineLabel}`,
        title: `${playerName}: ${statLabel} O/U ${lineLabel}`,
        shortName: `${playerName}: ${statLabel} O/U ${lineLabel}`,
        slug: `${prop.statType}-${slugify(playerName)}-${formatLineSlug(line)}`,
        outcomeYes: 'Over',
        outcomeNo: 'Under',
      }),
    ]
  })
}

function normalizeCustomMarketEntry(
  market: AdminSportsCustomMarketState,
  options: {
    homeTeamName: string
    awayTeamName: string
  },
) {
  const sportsMarketType = normalizeSportsMarketType(market.sportsMarketType)
  if (!sportsMarketType) {
    return null
  }

  const typeOption = resolveAdminSportsMarketTypeOption(sportsMarketType)
  const line = normalizeSignedLineInput(market.line)
  if (typeOption?.requiresLine && line === null) {
    return null
  }

  const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(sportsMarketType, {
    homeTeamName: options.homeTeamName,
    awayTeamName: options.awayTeamName,
  })
  const question = normalizeText(market.question)
  const title = normalizeText(market.title) || question
  const shortName = normalizeText(market.shortName) || title
  const outcomeOne = normalizeText(market.outcomeOne) || defaultOutcomes?.[0] || ''
  const outcomeTwo = normalizeText(market.outcomeTwo) || defaultOutcomes?.[1] || ''

  if (!question || !title || !shortName || !outcomeOne || !outcomeTwo) {
    return null
  }

  return {
    sportsMarketType,
    line,
    question,
    title,
    shortName,
    outcomeOne,
    outcomeTwo,
  }
}

function buildCustomMarketOptions(form: AdminSportsFormState) {
  const { homeTeam, awayTeam } = buildTeamPair(form.teams)
  const homeName = normalizeText(homeTeam?.name ?? '')
  const awayName = normalizeText(awayTeam?.name ?? '')

  return form.customMarkets.flatMap((market, index) => {
    const normalizedMarket = normalizeCustomMarketEntry(market, {
      homeTeamName: homeName,
      awayTeamName: awayName,
    })
    if (!normalizedMarket) {
      return []
    }

    const fallbackSlugBase = normalizedMarket.line === null
      ? slugifySportsMarketType(normalizedMarket.sportsMarketType)
      : `${slugifySportsMarketType(normalizedMarket.sportsMarketType)}-${formatLineSlug(normalizedMarket.line)}`
    const slug = slugify(
      normalizeText(market.slug)
      || normalizedMarket.title
      || normalizedMarket.question
      || fallbackSlugBase
      || `market-${index + 1}`,
    )
    if (!slug) {
      return []
    }

    return [
      createOption({
        id: market.id,
        question: normalizedMarket.question,
        title: normalizedMarket.title,
        shortName: normalizedMarket.shortName,
        slug,
        outcomeYes: normalizedMarket.outcomeOne,
        outcomeNo: normalizedMarket.outcomeTwo,
      }),
    ]
  })
}

function buildSportsOptions(form: AdminSportsFormState, eventDate: string) {
  if (form.eventVariant === 'custom') {
    const moneylineOptions = form.section === 'games'
      ? buildMoneylineOptions(form, eventDate)
      : []
    return [
      ...moneylineOptions,
      ...buildCustomMarketOptions(form),
    ]
  }

  if (form.section === 'games' && form.eventVariant) {
    return buildGameOptions(form, eventDate)
  }

  if (form.section === 'props') {
    return buildPropOptions(form)
  }

  return []
}

function buildSportsCategories(form: AdminSportsFormState, eventVariantSlug: string) {
  const out: SportsDerivedCategory[] = []
  const { homeTeam, awayTeam } = buildTeamPair(form.teams)
  const homeTeamName = normalizeText(homeTeam?.name ?? '')
  const awayTeamName = normalizeText(awayTeam?.name ?? '')

  function push(label: string, slug = label) {
    const normalizedLabel = normalizeText(label)
    const normalizedSlug = slugify(slug)
    if (!normalizedLabel || !normalizedSlug) {
      return
    }
    if (out.some(item => item.slug === normalizedSlug)) {
      return
    }
    out.push({
      label: normalizedLabel,
      slug: normalizedSlug,
    })
  }

  push('Sports')
  if (form.section) {
    push(form.section === 'games' ? 'Games' : 'Props', form.section)
  }

  if (form.section === 'games') {
    if (form.sportSlug.trim()) {
      push(form.sportSlug, form.sportSlug)
    }
    if (form.leagueSlug.trim()) {
      push(form.leagueSlug, form.leagueSlug)
    }
  }

  if (form.section === 'props') {
    push('Sports Props', 'sports-props')

    if (form.eventVariant === 'custom') {
      form.customMarkets.forEach((market) => {
        const normalizedMarket = normalizeCustomMarketEntry(market, {
          homeTeamName,
          awayTeamName,
        })
        if (!normalizedMarket) {
          return
        }

        const marketTypeLabel = resolveAdminSportsMarketTypeOption(normalizedMarket.sportsMarketType)?.label
          || normalizedMarket.sportsMarketType.replace(/_/g, ' ')
        push(marketTypeLabel, normalizedMarket.sportsMarketType)
      })
    }
    else {
      form.props.forEach((prop) => {
        if (!prop.statType) {
          return
        }

        push(buildPropLabel(prop.statType), prop.statType)
      })
    }
  }

  if (eventVariantSlug) {
    push(eventVariantSlug, eventVariantSlug)
  }

  return out
}

function buildBaseMoneylinePayloadMarkets(args: {
  optionsById: Map<string, SportsDerivedOption>
  includeDraw: boolean
}): AdminSportsPreparePayload['markets'] {
  const optionIds = args.includeDraw
    ? ['moneyline-home', 'moneyline-draw', 'moneyline-away']
    : ['moneyline-home', 'moneyline-away']

  return optionIds.flatMap((optionId, index) => {
    const option = args.optionsById.get(optionId)
    if (!option) {
      return []
    }

    return [{
      id: option.id,
      question: option.question,
      title: option.title,
      shortName: option.shortName,
      slug: option.slug,
      outcomes: [option.outcomeYes, option.outcomeNo] as [string, string],
      sportsMarketType: 'moneyline',
      groupItemTitle: option.title,
      groupItemThreshold: String(index),
      iconAssetKey: optionId === 'moneyline-home'
        ? 'home'
        : optionId === 'moneyline-away'
          ? 'away'
          : undefined,
    }]
  })
}

export function buildAdminSportsDerivedContent(args: {
  baseSlug: string
  sports: AdminSportsFormState
}): AdminSportsDerivedContent {
  const isGamesSection = args.sports.section === 'games'
  const effectiveEventVariant = args.sports.section === 'props'
    ? (args.sports.eventVariant === 'custom' ? 'custom' : 'standard')
    : args.sports.eventVariant
  const eventSlug = buildSportsEventSlug(args.baseSlug, effectiveEventVariant)
  const eventDate = isGamesSection ? buildEventDateFromStartTime(args.sports.startTime) : ''
  const startTimeIso = isGamesSection ? buildStartTimeIso(args.sports.startTime) : ''
  const options = buildSportsOptions(args.sports, eventDate)
  const variantSlug = args.sports.section && effectiveEventVariant
    ? buildSportVariantSlug(args.sports.section, effectiveEventVariant, options)
    : ''
  const categories = buildSportsCategories(args.sports, variantSlug)

  const payload = (() => {
    if (!args.sports.section || !effectiveEventVariant) {
      return null
    }

    const teams = args.sports.teams.map(team => ({
      name: normalizeText(team.name),
      abbreviation: normalizeText(team.abbreviation) || undefined,
      host_status: team.hostStatus,
    }))

    if (isGamesSection && teams.some(team => !team.name)) {
      return null
    }

    const props = args.sports.section === 'props' && effectiveEventVariant !== 'custom'
      ? args.sports.props.flatMap((prop) => {
          const playerName = normalizeText(prop.playerName)
          const line = normalizeLineInput(prop.line)
          if (!playerName || !prop.statType || line === null) {
            return []
          }

          const payloadItem: AdminSportsPreparePayload['props'][number] = {
            id: prop.id,
            playerName,
            statType: prop.statType,
            line,
          }

          if (prop.teamHostStatus === 'home' || prop.teamHostStatus === 'away') {
            payloadItem.teamHostStatus = prop.teamHostStatus
          }

          return [payloadItem]
        })
      : []

    const optionsById = new Map(options.map(option => [option.id, option]))
    const baseMoneylineMarkets = isGamesSection
      ? buildBaseMoneylinePayloadMarkets({
          optionsById,
          includeDraw: args.sports.includeDraw,
        })
      : []
    const customMarkets = effectiveEventVariant === 'custom'
      ? args.sports.customMarkets.flatMap((market, index) => {
          const option = optionsById.get(market.id)
          const sportsMarketType = normalizeSportsMarketType(market.sportsMarketType)
          if (!option || !sportsMarketType) {
            return []
          }

          const line = normalizeSignedLineInput(market.line)
          return [{
            id: market.id,
            question: option.question,
            title: option.title,
            shortName: option.shortName,
            slug: option.slug,
            outcomes: [option.outcomeYes, option.outcomeNo] as [string, string],
            sportsMarketType,
            line: line ?? undefined,
            groupItemTitle: normalizeText(market.groupItemTitle) || option.title,
            groupItemThreshold: String(baseMoneylineMarkets.length + index),
            iconAssetKey: args.sports.section === 'games'
              && (market.iconAssetKey === 'home' || market.iconAssetKey === 'away')
              ? market.iconAssetKey
              : undefined,
          }]
        })
      : []
    const markets = effectiveEventVariant === 'custom'
      ? [...baseMoneylineMarkets, ...customMarkets]
      : []

    if (effectiveEventVariant === 'custom' && customMarkets.length === 0) {
      return null
    }

    if (args.sports.section === 'props' && effectiveEventVariant !== 'custom' && props.length === 0) {
      return null
    }

    if (isGamesSection && (!args.sports.sportSlug.trim() || !args.sports.leagueSlug.trim() || !eventDate || !startTimeIso)) {
      return null
    }

    const payloadBase: AdminSportsPreparePayload = {
      section: args.sports.section,
      eventVariant: effectiveEventVariant,
      template: {
        includeDraw: args.sports.includeDraw,
        includeBothTeamsToScore: args.sports.includeBothTeamsToScore,
        includeSpreads: args.sports.includeSpreads,
        includeTotals: args.sports.includeTotals,
        spreadLines: SOCCER_MORE_MARKETS_SPREAD_LINES,
        totalLines: SOCCER_MORE_MARKETS_TOTAL_LINES,
      },
      props,
      markets,
    }

    if (isGamesSection) {
      payloadBase.sportSlug = slugify(args.sports.sportSlug)
      payloadBase.leagueSlug = slugify(args.sports.leagueSlug)
      payloadBase.eventDate = eventDate
      payloadBase.startTime = startTimeIso
      payloadBase.teams = teams
    }

    return payloadBase
  })()

  return {
    eventSlug,
    categories,
    options,
    payload,
  }
}

export function buildAdminSportsStepErrors(args: {
  step: number
  sports: AdminSportsFormState
  hasTeamLogoByHostStatus: Record<AdminSportsTeamHostStatus, boolean>
}) {
  const errors: string[] = []
  const eventDate = buildEventDateFromStartTime(args.sports.startTime)
  const { homeTeam, awayTeam } = buildTeamPair(args.sports.teams)
  const homeName = normalizeText(homeTeam?.name ?? '')
  const awayName = normalizeText(awayTeam?.name ?? '')

  if (args.step === 1) {
    if (!args.sports.section) {
      errors.push('Sports events must choose exactly one sub category: Games or Props.')
    }

    if (args.sports.section === 'games') {
      if (!args.sports.sportSlug.trim()) {
        errors.push('Sport slug is required for sports games.')
      }
      if (!args.sports.leagueSlug.trim()) {
        errors.push('League slug is required for sports games.')
      }
      if (!args.sports.startTime.trim()) {
        errors.push('Game start time is required for sports games.')
      }
      else if (!eventDate) {
        errors.push('Game start time is invalid.')
      }
      if (!homeName || !awayName) {
        errors.push('Sports games require both home and away teams.')
      }
      if (!args.hasTeamLogoByHostStatus.home || !args.hasTeamLogoByHostStatus.away) {
        errors.push('Sports games require a logo for both home and away teams.')
      }
    }
  }

  if (args.step === 2) {
    if (!args.sports.section) {
      errors.push('Sports section is required.')
      return errors
    }

    const validCustomMarkets = args.sports.customMarkets.filter((market) => {
      return Boolean(normalizeCustomMarketEntry(market, {
        homeTeamName: homeName,
        awayTeamName: awayName,
      }))
    })

    if (args.sports.section === 'games') {
      if (!args.sports.eventVariant) {
        errors.push('Select a sports template.')
        return errors
      }

      if (
        (args.sports.eventVariant === 'more_markets'
          || args.sports.eventVariant === 'exact_score'
          || args.sports.eventVariant === 'halftime_result')
        && slugify(args.sports.sportSlug) !== 'soccer'
      ) {
        errors.push('More Markets, Exact Score, and Halftime Result currently require sport slug "soccer".')
      }

      if (
        args.sports.eventVariant === 'more_markets'
        && !args.sports.includeBothTeamsToScore
        && !args.sports.includeSpreads
        && !args.sports.includeTotals
      ) {
        errors.push('Select at least one pack inside More Markets.')
      }

      if (args.sports.eventVariant === 'custom' && validCustomMarkets.length === 0) {
        errors.push('Add at least 1 fully configured custom sports market.')
      }
    }

    if (args.sports.section === 'props') {
      if (args.sports.eventVariant === 'custom') {
        if (validCustomMarkets.length === 0) {
          errors.push('Add at least 1 fully configured custom sports market.')
        }
        return errors
      }

      const validProps = args.sports.props.filter((prop) => {
        return Boolean(
          normalizeText(prop.playerName)
          && prop.statType
          && normalizeLineInput(prop.line) !== null,
        )
      })

      if (validProps.length === 0) {
        errors.push('Add at least 1 fully configured prop line.')
      }
    }
  }

  return errors
}
