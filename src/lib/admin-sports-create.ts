export type AdminSportsSection = 'games' | 'props'
export type AdminSportsEventVariant = 'standard' | 'more_markets' | 'exact_score' | 'halftime_result'
export type AdminSportsTeamHostStatus = 'home' | 'away'
export type AdminSportsPropStatType = 'points' | 'rebounds' | 'assists'

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
}

export interface AdminSportsPreparePayload {
  section: AdminSportsSection
  eventVariant: AdminSportsEventVariant
  sportSlug: string
  leagueSlug: string
  eventDate: string
  startTime: string
  teams: Array<{
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
    teamHostStatus: AdminSportsTeamHostStatus
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
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
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

function buildEventDateFromStartTime(startTime: string) {
  const parsed = parseStartTime(startTime)
  return parsed ? parsed.toISOString().slice(0, 10) : ''
}

function buildStartTimeIso(startTime: string) {
  const parsed = parseStartTime(startTime)
  return parsed ? parsed.toISOString() : ''
}

function buildSportVariantSlug(section: AdminSportsSection, eventVariant: AdminSportsEventVariant, options: SportsDerivedOption[]) {
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

function buildGameOptions(form: AdminSportsFormState, eventDate: string): SportsDerivedOption[] {
  const { homeTeam, awayTeam } = buildTeamPair(form.teams)
  const homeName = normalizeText(homeTeam?.name ?? '')
  const awayName = normalizeText(awayTeam?.name ?? '')
  if (!homeName || !awayName || !eventDate) {
    return []
  }

  if (form.eventVariant === 'more_markets') {
    const options: SportsDerivedOption[] = []

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
    const options = EXACT_SCORE_GRID.map(({ homeScore, awayScore }) => createOption({
      id: `exact-score-${homeScore}-${awayScore}`,
      question: `Exact Score: ${homeName} ${homeScore} - ${awayScore} ${awayName}?`,
      title: `Exact Score: ${homeScore}-${awayScore}`,
      shortName: `Exact Score: ${homeScore}-${awayScore}`,
      slug: `exact-score-${homeScore}-${awayScore}`,
    }))

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

function buildPropLabel(statType: AdminSportsPropStatType) {
  switch (statType) {
    case 'points':
      return 'Points'
    case 'rebounds':
      return 'Rebounds'
    case 'assists':
      return 'Assists'
  }
}

function buildPropOptions(form: AdminSportsFormState) {
  return form.props.flatMap((prop) => {
    const playerName = normalizeText(prop.playerName)
    const line = normalizeLineInput(prop.line)
    if (!playerName || !prop.statType || line === null || !prop.teamHostStatus) {
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

function buildSportsOptions(form: AdminSportsFormState, eventDate: string) {
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
  if (form.sportSlug.trim()) {
    push(form.sportSlug, form.sportSlug)
  }
  if (form.leagueSlug.trim()) {
    push(form.leagueSlug, form.leagueSlug)
  }
  if (eventVariantSlug) {
    push(eventVariantSlug, eventVariantSlug)
  }

  return out
}

export function buildAdminSportsDerivedContent(args: {
  baseSlug: string
  sports: AdminSportsFormState
}): AdminSportsDerivedContent {
  const effectiveEventVariant = args.sports.section === 'props'
    ? 'standard'
    : args.sports.eventVariant
  const eventSlug = buildSportsEventSlug(args.baseSlug, effectiveEventVariant)
  const eventDate = buildEventDateFromStartTime(args.sports.startTime)
  const startTimeIso = buildStartTimeIso(args.sports.startTime)
  const options = buildSportsOptions(args.sports, eventDate)
  const variantSlug = args.sports.section && effectiveEventVariant
    ? buildSportVariantSlug(args.sports.section, effectiveEventVariant, options)
    : ''
  const categories = buildSportsCategories(args.sports, variantSlug)

  const payload = (() => {
    if (
      !args.sports.section
      || !effectiveEventVariant
      || !args.sports.sportSlug.trim()
      || !args.sports.leagueSlug.trim()
      || !eventDate
      || !startTimeIso
    ) {
      return null
    }

    const teams = args.sports.teams.map(team => ({
      name: normalizeText(team.name),
      abbreviation: normalizeText(team.abbreviation) || undefined,
      host_status: team.hostStatus,
    }))

    if (teams.some(team => !team.name)) {
      return null
    }

    const props = args.sports.section === 'props'
      ? args.sports.props.flatMap((prop) => {
          const playerName = normalizeText(prop.playerName)
          const line = normalizeLineInput(prop.line)
          if (!playerName || !prop.statType || line === null || !prop.teamHostStatus) {
            return []
          }

          return [{
            id: prop.id,
            playerName,
            statType: prop.statType,
            line,
            teamHostStatus: prop.teamHostStatus,
          }]
        })
      : []

    if (args.sports.section === 'props' && props.length === 0) {
      return null
    }

    return {
      section: args.sports.section,
      eventVariant: effectiveEventVariant,
      sportSlug: slugify(args.sports.sportSlug),
      leagueSlug: slugify(args.sports.leagueSlug),
      eventDate,
      startTime: startTimeIso,
      teams,
      template: {
        includeDraw: args.sports.includeDraw,
        includeBothTeamsToScore: args.sports.includeBothTeamsToScore,
        includeSpreads: args.sports.includeSpreads,
        includeTotals: args.sports.includeTotals,
        spreadLines: SOCCER_MORE_MARKETS_SPREAD_LINES,
        totalLines: SOCCER_MORE_MARKETS_TOTAL_LINES,
      },
      props,
    }
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
    if (!args.sports.sportSlug.trim()) {
      errors.push('Sport slug is required for sports events.')
    }
    if (!args.sports.leagueSlug.trim()) {
      errors.push('League slug is required for sports events.')
    }
    if (!args.sports.startTime.trim()) {
      errors.push('Game start time is required for sports events.')
    }
    else if (!eventDate) {
      errors.push('Game start time is invalid.')
    }
    if (!homeName || !awayName) {
      errors.push('Sports events require both home and away teams.')
    }
    if (!args.hasTeamLogoByHostStatus.home || !args.hasTeamLogoByHostStatus.away) {
      errors.push('Sports events require a logo for both home and away teams.')
    }
  }

  if (args.step === 2) {
    if (!args.sports.section) {
      errors.push('Sports section is required.')
      return errors
    }

    if (args.sports.section === 'games') {
      if (!args.sports.eventVariant) {
        errors.push('Select a sports event variant.')
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
    }

    if (args.sports.section === 'props') {
      const validProps = args.sports.props.filter((prop) => {
        return Boolean(
          normalizeText(prop.playerName)
          && prop.statType
          && normalizeLineInput(prop.line) !== null
          && prop.teamHostStatus,
        )
      })

      if (validProps.length === 0) {
        errors.push('Add at least 1 fully configured prop line.')
      }
    }
  }

  return errors
}
