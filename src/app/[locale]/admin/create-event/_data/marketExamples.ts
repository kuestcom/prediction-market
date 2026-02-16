export type MarketMode = 'binary' | 'multi_multiple' | 'multi_unique'

interface BinaryExample {
  question: string
  outcomes: [string, string]
}

interface ExampleOption {
  title: string
  shortName: string
}

export interface MarketExample {
  eventTitle: string
  sourceUrl: string
  rulesHint: string
  binary?: BinaryExample
  options?: ExampleOption[]
}

type ModeExamples = Record<MarketMode, MarketExample>

const DEFAULT_EXAMPLES: ModeExamples = {
  binary: {
    eventTitle: 'Will the Fed cut rates after the March 2026 meeting?',
    sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    rulesHint: 'Resolve from official announcement in UTC, including cancellation and fallback source handling.',
    binary: {
      question: 'Will the Fed cut rates after the March 2026 meeting?',
      outcomes: ['Yes', 'No'],
    },
  },
  multi_unique: {
    eventTitle: '2026 NBA Champion',
    sourceUrl: 'https://www.nba.com/',
    rulesHint: 'Resolve by official league champion publication.',
    options: [
      { title: 'Boston Celtics', shortName: 'Celtics' },
      { title: 'Denver Nuggets', shortName: 'Nuggets' },
      { title: 'Oklahoma City Thunder', shortName: 'Thunder' },
      { title: 'Other', shortName: 'Other' },
    ],
  },
  multi_multiple: {
    eventTitle: 'Bitcoin above ___ on March 10, 2026?',
    sourceUrl: 'https://www.coingecko.com/en/coins/bitcoin',
    rulesHint: 'Threshold options resolve independently. Multiple options may resolve true.',
    options: [
      { title: '$100,000', shortName: '100k' },
      { title: '$110,000', shortName: '110k' },
      { title: '$120,000', shortName: '120k' },
    ],
  },
}

const EXAMPLES_BY_CATEGORY: Record<string, ModeExamples> = {
  sports: {
    binary: {
      eventTitle: 'Will FC Barcelona win on 2026-02-21?',
      sourceUrl: 'https://www.fifa.com/',
      rulesHint: 'Resolve by official final result publication for the listed fixture.',
      binary: {
        question: 'Will FC Barcelona win on 2026-02-21?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: '2026 NBA Champion',
      sourceUrl: 'https://www.nba.com/',
      rulesHint: 'Resolve by official league champion publication.',
      options: [
        { title: 'Boston Celtics', shortName: 'Celtics' },
        { title: 'Denver Nuggets', shortName: 'Nuggets' },
        { title: 'Oklahoma City Thunder', shortName: 'Thunder' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'LeBron milestones in next game',
      sourceUrl: 'https://www.nba.com/stats',
      rulesHint: 'Each milestone resolves independently; multiple outcomes can be true.',
      options: [
        { title: '20+ points', shortName: '20+ PTS' },
        { title: '8+ assists', shortName: '8+ AST' },
        { title: '8+ rebounds', shortName: '8+ REB' },
      ],
    },
  },
  politics: {
    binary: {
      eventTitle: 'Will the U.S. Senate pass the budget by March 31, 2026?',
      sourceUrl: 'https://www.congress.gov/',
      rulesHint: 'Resolve by official congressional record in UTC with fallback source defined.',
      binary: {
        question: 'Will the U.S. Senate pass the budget by March 31, 2026?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Republican Presidential Nominee 2028',
      sourceUrl: 'https://www.fec.gov/',
      rulesHint: 'Resolve by official nominee declaration from convention records.',
      options: [
        { title: 'Ron DeSantis', shortName: 'DeSantis' },
        { title: 'Nikki Haley', shortName: 'Haley' },
        { title: 'JD Vance', shortName: 'Vance' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'US sanctions package announced by...?',
      sourceUrl: 'https://www.state.gov/',
      rulesHint: 'Date thresholds can stack; multiple outcomes may resolve true.',
      options: [
        { title: 'By March 15, 2026', shortName: 'Mar 15' },
        { title: 'By March 31, 2026', shortName: 'Mar 31' },
        { title: 'By April 30, 2026', shortName: 'Apr 30' },
      ],
    },
  },
  crypto: {
    binary: {
      eventTitle: 'Will Bitcoin close above $120,000 on March 10, 2026?',
      sourceUrl: 'https://www.coindesk.com/price/bitcoin/',
      rulesHint: 'Resolve by defined source and UTC cutoff time.',
      binary: {
        question: 'Will Bitcoin close above $120,000 on March 10, 2026?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Which chain will have the highest fees on March 2026?',
      sourceUrl: 'https://www.theblock.co/data',
      rulesHint: 'Resolve by highest total fees in the configured date window.',
      options: [
        { title: 'Ethereum', shortName: 'ETH' },
        { title: 'Solana', shortName: 'SOL' },
        { title: 'Bitcoin', shortName: 'BTC' },
        { title: 'Base', shortName: 'BASE' },
      ],
    },
    multi_multiple: {
      eventTitle: 'Bitcoin above ___ on March 10, 2026?',
      sourceUrl: 'https://www.coingecko.com/en/coins/bitcoin',
      rulesHint: 'Threshold outcomes can resolve together.',
      options: [
        { title: '$100,000', shortName: '100k' },
        { title: '$110,000', shortName: '110k' },
        { title: '$120,000', shortName: '120k' },
      ],
    },
  },
  economy: {
    binary: {
      eventTitle: 'Will the Fed cut rates after the March 2026 meeting?',
      sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
      rulesHint: 'Resolve from official FOMC statement publication.',
      binary: {
        question: 'Will the Fed cut rates after the March 2026 meeting?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Who will be the next Fed Chair?',
      sourceUrl: 'https://www.whitehouse.gov/',
      rulesHint: 'Resolve using nomination and confirmation rule configured for the event.',
      options: [
        { title: 'Jerome Powell', shortName: 'Powell' },
        { title: 'Judy Shelton', shortName: 'Shelton' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'U.S. CPI YoY on release date above...?',
      sourceUrl: 'https://www.bls.gov/cpi/',
      rulesHint: 'Threshold outcomes can resolve together based on headline CPI YoY.',
      options: [
        { title: '2.5%', shortName: '2.5%' },
        { title: '3.0%', shortName: '3.0%' },
        { title: '3.5%', shortName: '3.5%' },
      ],
    },
  },
  culture: {
    binary: {
      eventTitle: 'Will Dune: Part Three win Best Picture in 2027?',
      sourceUrl: 'https://www.oscars.org/',
      rulesHint: 'Resolve by official Academy winner publication.',
      binary: {
        question: 'Will Dune: Part Three win Best Picture in 2027?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Best Picture Winner 2027',
      sourceUrl: 'https://www.oscars.org/',
      rulesHint: 'Resolve by official winner list. Exactly one winner outcome.',
      options: [
        { title: 'Film A', shortName: 'Film A' },
        { title: 'Film B', shortName: 'Film B' },
        { title: 'Film C', shortName: 'Film C' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'Words spoken in acceptance speech',
      sourceUrl: 'https://www.youtube.com/',
      rulesHint: 'Each word resolves independently; multiple outcomes can resolve true.',
      options: [
        { title: 'Thank you', shortName: 'Thanks' },
        { title: 'Family', shortName: 'Family' },
        { title: 'Future', shortName: 'Future' },
      ],
    },
  },
  geopolitics: {
    binary: {
      eventTitle: 'Will a ceasefire agreement be signed by June 30, 2026?',
      sourceUrl: 'https://www.reuters.com/world/',
      rulesHint: 'Resolve only on formal signed agreement announcement.',
      binary: {
        question: 'Will a ceasefire agreement be signed by June 30, 2026?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Which coalition will form the next Dutch government?',
      sourceUrl: 'https://www.government.nl/',
      rulesHint: 'Resolve by official coalition formation announcement.',
      options: [
        { title: 'VVD + CDA + JA21', shortName: 'VVD+CDA' },
        { title: 'GL-PvdA + VVD + NSC', shortName: 'GL+VVD' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'Sanctions announced this month',
      sourceUrl: 'https://www.treasury.gov/',
      rulesHint: 'Sanction classes resolve independently; multiple outcomes can be true.',
      options: [
        { title: 'Energy sector sanctions', shortName: 'Energy' },
        { title: 'Banking sanctions', shortName: 'Banking' },
        { title: 'Defense sanctions', shortName: 'Defense' },
      ],
    },
  },
  weather: {
    binary: {
      eventTitle: 'Will New York City record at least 1 inch of snow on 2026-12-25?',
      sourceUrl: 'https://www.weather.gov/',
      rulesHint: 'Resolve from official NOAA/NWS daily snowfall report.',
      binary: {
        question: 'Will New York City record at least 1 inch of snow on 2026-12-25?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Which city will record the highest temperature on 2026-07-15?',
      sourceUrl: 'https://www.noaa.gov/',
      rulesHint: 'Resolve by highest official temperature among listed cities.',
      options: [
        { title: 'Phoenix', shortName: 'PHX' },
        { title: 'Las Vegas', shortName: 'LV' },
        { title: 'Dallas', shortName: 'DAL' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'US hurricane season milestones in 2026',
      sourceUrl: 'https://www.nhc.noaa.gov/',
      rulesHint: 'Milestones resolve independently and can all be true.',
      options: [
        { title: 'Named storm by June 30', shortName: 'Jun 30' },
        { title: 'Category 3+ storm by Aug 31', shortName: 'Aug 31' },
        { title: 'US landfall by Sep 30', shortName: 'Sep 30' },
      ],
    },
  },
  tech: {
    binary: {
      eventTitle: 'Will Apple launch new AR smart glasses before 2027?',
      sourceUrl: 'https://www.apple.com/newsroom/',
      rulesHint: 'Resolve by official launch announcement from the company.',
      binary: {
        question: 'Will Apple launch new AR smart glasses before 2027?',
        outcomes: ['Yes', 'No'],
      },
    },
    multi_unique: {
      eventTitle: 'Which company will release the top AI model benchmark score in Q4 2026?',
      sourceUrl: 'https://paperswithcode.com/sota',
      rulesHint: 'Resolve using predefined benchmark and publication window.',
      options: [
        { title: 'OpenAI', shortName: 'OpenAI' },
        { title: 'Google', shortName: 'Google' },
        { title: 'Anthropic', shortName: 'Anthropic' },
        { title: 'Other', shortName: 'Other' },
      ],
    },
    multi_multiple: {
      eventTitle: 'Big Tech product launches in Q4 2026',
      sourceUrl: 'https://www.theverge.com/tech',
      rulesHint: 'Each company launch outcome resolves independently.',
      options: [
        { title: 'Apple hardware launch', shortName: 'Apple' },
        { title: 'Google hardware launch', shortName: 'Google' },
        { title: 'Meta hardware launch', shortName: 'Meta' },
      ],
    },
  },
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  sports: ['sports', 'sport', 'games', 'soccer', 'nba', 'basketball', 'esports'],
  politics: ['politics', 'elections', 'us-election', 'world-elections', 'election'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain'],
  economy: ['economy', 'finance', 'macro', 'fed', 'rates'],
  culture: ['culture', 'movies', 'entertainment', 'awards'],
  geopolitics: ['geopolitics', 'world', 'middle-east', 'foreign-policy'],
  weather: ['weather', 'climate', 'temperature', 'hurricane'],
  tech: ['tech', 'technology', 'ai', 'big-tech'],
}

function normalizeCategory(mainCategorySlug?: string | null): keyof typeof EXAMPLES_BY_CATEGORY | null {
  const slug = (mainCategorySlug ?? '').trim().toLowerCase()
  if (!slug) {
    return null
  }

  const exactMatch = Object.keys(EXAMPLES_BY_CATEGORY).find(key => key === slug)
  if (exactMatch) {
    return exactMatch as keyof typeof EXAMPLES_BY_CATEGORY
  }

  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some(alias => slug === alias || slug.includes(alias))) {
      return category as keyof typeof EXAMPLES_BY_CATEGORY
    }
  }

  return null
}

export function getMarketExample(mainCategorySlug: string | null, marketMode: MarketMode | null): MarketExample | null {
  if (!marketMode) {
    return null
  }

  const normalizedCategory = normalizeCategory(mainCategorySlug)
  if (normalizedCategory) {
    return EXAMPLES_BY_CATEGORY[normalizedCategory][marketMode]
  }

  return DEFAULT_EXAMPLES[marketMode]
}
