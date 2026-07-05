export function buildHomeFeaturedNewsSearchPromptLines() {
  const currentDate = new Date().toISOString().slice(0, 10)

  return [
    `Current date: ${currentDate}. Prefer articles published today or in the last 48 hours when the event is time-sensitive.`,
    'Use broad live web search first. Source hints are preferred publications/domains, not a whitelist; if they have no relevant article, use another reputable source.',
    'For sports matchups, search exact and close variants such as "Team A vs Team B", "Team A v Team B", lineups, injuries, preview, prediction, live, result, and the league/tournament name.',
  ]
}
