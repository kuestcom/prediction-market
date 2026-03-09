export interface OutcomeButtonTheme {
  background: string
  color: string
}

const NEGATIVE_OUTCOME_WORDS = new Set(['down', 'lose', 'loses', 'lost', 'no', 'under'])
const POSITIVE_OUTCOME_WORDS = new Set(['over', 'up', 'win', 'wins', 'won', 'yes'])

function tokenizeOutcomeLabel(label: string) {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? []
}

function hasOutcomeWord(tokens: string[], words: Set<string>) {
  return tokens.some(token => words.has(token))
}

export function resolveOutcomeButtonTheme(label: string, index: number): OutcomeButtonTheme {
  const tokens = tokenizeOutcomeLabel(label)

  if (hasOutcomeWord(tokens, NEGATIVE_OUTCOME_WORDS)) {
    return {
      background: '#fbeaea',
      color: '#d65757',
    }
  }

  if (hasOutcomeWord(tokens, POSITIVE_OUTCOME_WORDS)) {
    return {
      background: '#e8f5ee',
      color: '#2b9a68',
    }
  }

  return index % 2 === 0
    ? {
        background: '#eef4ff',
        color: '#3468d6',
      }
    : {
        background: '#f4efff',
        color: '#7c4ed8',
      }
}
