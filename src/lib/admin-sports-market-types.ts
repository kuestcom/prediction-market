export type AdminSportsMarketTypeSection = 'games' | 'props'
export type AdminSportsMarketOutcomePreset = 'yes_no' | 'over_under' | 'odd_even' | 'home_away'

export interface AdminSportsMarketTypeOption {
  value: string
  label: string
  group: string
  section: AdminSportsMarketTypeSection
  outcomePreset: AdminSportsMarketOutcomePreset
  requiresLine?: boolean
}

const OPTIONS: AdminSportsMarketTypeOption[] = [
  { value: 'moneyline', label: 'Moneyline', group: 'Core Game Lines', section: 'games', outcomePreset: 'home_away' },
  { value: 'child_moneyline', label: 'Map / Game Winner', group: 'Core Game Lines', section: 'games', outcomePreset: 'home_away' },
  { value: 'spreads', label: 'Spreads', group: 'Core Game Lines', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'totals', label: 'Totals', group: 'Core Game Lines', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'team_totals', label: 'Team Totals', group: 'Core Game Lines', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'both_teams_to_score', label: 'Both Teams To Score', group: 'Core Game Lines', section: 'games', outcomePreset: 'yes_no' },
  { value: 'first_half_moneyline', label: '1H Moneyline', group: 'Core Game Lines', section: 'games', outcomePreset: 'home_away' },
  { value: 'first_half_spreads', label: '1H Spreads', group: 'Core Game Lines', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'first_half_totals', label: '1H Totals', group: 'Core Game Lines', section: 'games', outcomePreset: 'over_under', requiresLine: true },

  { value: 'soccer_exact_score', label: 'Exact Score Selection', group: 'Soccer Specials', section: 'games', outcomePreset: 'yes_no' },
  { value: 'soccer_halftime_result', label: 'Halftime Result Selection', group: 'Soccer Specials', section: 'games', outcomePreset: 'yes_no' },

  { value: 'tennis_match_totals', label: 'Match Totals', group: 'Tennis', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'tennis_first_set_totals', label: 'First Set Totals', group: 'Tennis', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'tennis_set_totals', label: 'Set Totals', group: 'Tennis', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'tennis_first_set_winner', label: 'First Set Winner', group: 'Tennis', section: 'games', outcomePreset: 'home_away' },
  { value: 'tennis_set_handicap', label: 'Set Handicap', group: 'Tennis', section: 'games', outcomePreset: 'home_away', requiresLine: true },

  { value: 'ufc_go_the_distance', label: 'Go The Distance', group: 'Combat Sports', section: 'games', outcomePreset: 'yes_no' },
  { value: 'ufc_method_of_victory', label: 'Method Of Victory Selection', group: 'Combat Sports', section: 'games', outcomePreset: 'yes_no' },

  { value: 'cricket_toss_winner', label: 'Toss Winner', group: 'Cricket', section: 'games', outcomePreset: 'home_away' },
  { value: 'cricket_completed_match', label: 'Completed Match', group: 'Cricket', section: 'games', outcomePreset: 'yes_no' },
  { value: 'cricket_match_to_go_till', label: 'Match To Go Till Selection', group: 'Cricket', section: 'games', outcomePreset: 'yes_no' },
  { value: 'cricket_most_sixes', label: 'Most Sixes Selection', group: 'Cricket', section: 'games', outcomePreset: 'yes_no' },
  { value: 'cricket_team_top_batter', label: 'Team Top Batter Selection', group: 'Cricket', section: 'games', outcomePreset: 'yes_no' },
  { value: 'cricket_toss_match_double', label: 'Toss Match Double Selection', group: 'Cricket', section: 'games', outcomePreset: 'yes_no' },

  { value: 'kill_over_under_game', label: 'Game Kill O/U', group: 'Esports Game / Map', section: 'games', outcomePreset: 'over_under', requiresLine: true },
  { value: 'map_handicap', label: 'Map Handicap', group: 'Esports Game / Map', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'cs2_odd_even_total_kills', label: 'Odd / Even Total Kills', group: 'Esports Game / Map', section: 'games', outcomePreset: 'odd_even' },
  { value: 'cs2_odd_even_total_rounds', label: 'Odd / Even Total Rounds', group: 'Esports Game / Map', section: 'games', outcomePreset: 'odd_even' },
  { value: 'lol_odd_even_total_kills', label: 'LoL Odd / Even Total Kills', group: 'Esports Game / Map', section: 'games', outcomePreset: 'odd_even' },
  { value: 'first_blood_game', label: 'First Blood', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'lol_both_teams_dragon', label: 'Both Teams Slay Dragon', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'lol_both_teams_baron', label: 'Both Teams Slay Baron', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'lol_both_teams_inhibitors', label: 'Both Teams Destroy Inhibitors', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'lol_quadra_kill', label: 'Any Player Quadra Kill', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'lol_penta_kill', label: 'Any Player Penta Kill', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'dota2_game_ends_daytime', label: 'Game Ends In Daytime', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'dota2_both_teams_barracks', label: 'Both Teams Destroy Barracks', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'dota2_both_teams_roshan', label: 'Both Teams Beat Roshan', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'dota2_rampage', label: 'Any Player Rampage', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },
  { value: 'dota2_ultra_kill', label: 'Any Player Ultra Kill', group: 'Esports Game / Map', section: 'games', outcomePreset: 'yes_no' },

  { value: 'kill_handicap_match', label: 'Series Kill Handicap', group: 'Esports Series', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'kill_most_2_way_match', label: 'Series Most Kills', group: 'Esports Series', section: 'games', outcomePreset: 'home_away' },
  { value: 'drake_most_2_way_match', label: 'Series Most Drakes', group: 'Esports Series', section: 'games', outcomePreset: 'home_away' },
  { value: 'nashor_most_2_way_match', label: 'Series Most Nashors', group: 'Esports Series', section: 'games', outcomePreset: 'home_away' },
  { value: 'tower_most_2_way_match', label: 'Series Most Towers', group: 'Esports Series', section: 'games', outcomePreset: 'home_away' },
  { value: 'inhibitor_most_2_way_match', label: 'Series Most Inhibitors', group: 'Esports Series', section: 'games', outcomePreset: 'home_away' },
  { value: 'drake_handicap_match', label: 'Series Drake Handicap', group: 'Esports Series', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'tower_handicap_match', label: 'Series Tower Handicap', group: 'Esports Series', section: 'games', outcomePreset: 'home_away', requiresLine: true },
  { value: 'inhibitor_handicap_match', label: 'Series Inhibitor Handicap', group: 'Esports Series', section: 'games', outcomePreset: 'home_away', requiresLine: true },

  { value: 'points', label: 'Points O/U', group: 'Props', section: 'props', outcomePreset: 'over_under', requiresLine: true },
  { value: 'rebounds', label: 'Rebounds O/U', group: 'Props', section: 'props', outcomePreset: 'over_under', requiresLine: true },
  { value: 'assists', label: 'Assists O/U', group: 'Props', section: 'props', outcomePreset: 'over_under', requiresLine: true },
  { value: 'receiving_yards', label: 'Receiving Yards O/U', group: 'Props', section: 'props', outcomePreset: 'over_under', requiresLine: true },
  { value: 'rushing_yards', label: 'Rushing Yards O/U', group: 'Props', section: 'props', outcomePreset: 'over_under', requiresLine: true },
  { value: 'anytime_touchdowns', label: 'Anytime Touchdown Selection', group: 'Props', section: 'props', outcomePreset: 'yes_no' },
  { value: 'first_touchdowns', label: 'First Touchdown Selection', group: 'Props', section: 'props', outcomePreset: 'yes_no' },
  { value: 'two_plus_touchdowns', label: '2+ Touchdowns Selection', group: 'Props', section: 'props', outcomePreset: 'yes_no' },
]

export function getAdminSportsMarketTypeGroups(section: AdminSportsMarketTypeSection) {
  const groups = new Map<string, AdminSportsMarketTypeOption[]>()

  for (const option of OPTIONS) {
    if (option.section !== section) {
      continue
    }

    const current = groups.get(option.group) ?? []
    current.push(option)
    groups.set(option.group, current)
  }

  return Array.from(groups.entries()).map(([label, options]) => ({ label, options }))
}

export function resolveAdminSportsMarketTypeOption(value: string | null | undefined) {
  return OPTIONS.find(option => option.value === value) ?? null
}

export function getAdminSportsMarketTypeDefaultOutcomes(
  marketType: string | null | undefined,
  context?: {
    homeTeamName?: string | null
    awayTeamName?: string | null
  },
) {
  const option = resolveAdminSportsMarketTypeOption(marketType)
  if (!option) {
    return null
  }

  switch (option.outcomePreset) {
    case 'over_under':
      return ['Over', 'Under'] as const
    case 'odd_even':
      return ['Odd', 'Even'] as const
    case 'home_away':
      return [
        context?.homeTeamName?.trim() || 'Home',
        context?.awayTeamName?.trim() || 'Away',
      ] as const
    case 'yes_no':
      return ['Yes', 'No'] as const
  }
}
