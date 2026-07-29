export interface MarketContextVariable {
  key: string
  label: string
  description: string
}

export const MARKET_CONTEXT_VARIABLES: MarketContextVariable[] = [
  { key: 'event-title', label: 'Event title', description: 'Full event headline.' },
  { key: 'event-description', label: 'Event description', description: 'Primary description provided for the event.' },
  { key: 'event-main-tag', label: 'Main tag', description: 'Primary tag associated with the event.' },
  { key: 'event-creator', label: 'Creator', description: 'Event creator name or address.' },
  { key: 'event-created-at', label: 'Created at', description: 'ISO timestamp for when the event was created.' },
  {
    key: 'market-estimated-end-date',
    label: 'Estimated end date',
    description: 'Best estimate for when the market should resolve.',
  },
  { key: 'market-title', label: 'Focused market title', description: 'Title for the selected market.' },
  { key: 'market-probability', label: 'Implied probability', description: 'Probability formatted as a percentage.' },
  { key: 'market-price', label: 'Reference price', description: 'Current YES share price formatted in cents.' },
  { key: 'market-volume-24h', label: '24h volume', description: '24 hour trading volume in USD.' },
  { key: 'market-volume-total', label: 'Lifetime volume', description: 'Lifetime trading volume in USD.' },
  { key: 'market-outcomes', label: 'Outcome snapshot', description: 'Multi-line bullet list detailing each outcome.' },
]

export const MARKET_CONTEXT_PROMPT_DEFAULT = [
  'Using the structured market data below, produce a narrative context similar to high-quality prediction market recaps.',
  'Combine up to three short paragraphs (each 2-4 sentences) that cover:',
  '1. Current market positioning and key probability/volume metrics.',
  '2. Recent catalysts, news, or narratives that could influence outcomes (leverage web browsing if your model supports it).',
  '3. Competitive dynamics, risk factors, or what to watch next for traders.',
  'Whenever citing probabilities or monetary figures, quote the numbers explicitly.',
  'If external research is performed, integrate it fluidly without citing URLs.',
  'Never return bullet points—write clean paragraphs.',
  '',
  'Structured data:',
  'Event title: [event-title]',
  'Event description: [event-description]',
  'Main tag: [event-main-tag]',
  'Creator: [event-creator]',
  'Created at: [event-created-at]',
  'Focused market title: [market-title]',
  'Estimated end date: [market-estimated-end-date]',
  'Implied probability: [market-probability]',
  'Reference price per YES share: [market-price]',
  '24h volume: [market-volume-24h]',
  'Lifetime volume: [market-volume-total]',
  'Outcome snapshot:',
  '[market-outcomes]',
].join('\n')
