import type { OpenRouterMessage } from '@/lib/ai/openrouter'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { requestOpenRouterCompletion } from '@/lib/ai/openrouter'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'

const GAMMA_MARKETS_ENDPOINT = 'https://gamma-api.polymarket.com/markets?limit=200&offset=0&active=true&closed=false'
const RULES_SAMPLE_LIMIT = 8
const RULES_SAMPLE_MAX_CHARS = 420
const REQUEST_TIMEOUT_MS = 12000
const RULES_MIN_LENGTH = 60
const INTERNAL_RULES_TERMS = [
  'marketmode',
  'binaryquestion',
  'multi_multiple',
  'multi_unique',
  'options array',
  'enddateiso',
  'maincategoryslug',
  'subcategories',
]

const optionSchema = z.object({
  question: z.string().optional().default(''),
  title: z.string().optional().default(''),
  shortName: z.string().optional().default(''),
  slug: z.string().optional().default(''),
})

const categorySchema = z.union([
  z.string(),
  z.object({
    label: z.string().optional().default(''),
    slug: z.string().optional().default(''),
    name: z.string().optional().default(''),
  }),
])

const dataSchema = z.object({
  title: z.string().optional().default(''),
  slug: z.string().optional().default(''),
  endDateIso: z.string().optional().default(''),
  mainCategorySlug: z.string().optional().default(''),
  categories: z.array(categorySchema).optional().default([]),
  marketMode: z.enum(['binary', 'multi_multiple', 'multi_unique']).nullable().optional().default(null),
  binaryQuestion: z.string().optional().default(''),
  binaryOutcomeYes: z.string().optional().default(''),
  binaryOutcomeNo: z.string().optional().default(''),
  options: z.array(optionSchema).optional().default([]),
  resolutionSource: z.string().optional().default(''),
  resolutionRules: z.string().optional().default(''),
})

const requestSchema = z.object({
  mode: z.enum(['generate_rules', 'check_content']),
  data: dataSchema,
})

const aiErrorSchema = z.object({
  code: z.enum(['english', 'url', 'rules', 'mandatory', 'date']),
  reason: z.string().min(4),
  step: z.number().int().min(1).max(3),
})

const aiContentCheckSchema = z.object({
  ok: z.boolean(),
  errors: z.array(aiErrorSchema).optional().default([]),
})

interface GammaMarket {
  id?: string
  question?: string
  description?: string
  negRisk?: boolean
  events?: Array<{
    title?: string
  }>
}

interface RulesSample {
  marketId: string
  text: string
}

interface AiError {
  code: 'english' | 'url' | 'rules' | 'mandatory' | 'date'
  reason: string
  step: 1 | 2 | 3
}

function normalizeText(input: unknown) {
  return typeof input === 'string' ? input.trim() : ''
}

function normalizeCategoryValues(input: z.infer<typeof dataSchema>) {
  return input.categories
    .map((category) => {
      if (typeof category === 'string') {
        return normalizeText(category)
      }

      return normalizeText(category.slug || category.label || category.name)
    })
    .filter(Boolean)
}

function parseJsonObject<T>(raw: string, schema: z.ZodSchema<T>): T {
  const normalized = raw.trim()
  const candidate = extractCodeFenceBody(normalized) ?? normalized
  const firstIndex = candidate.indexOf('{')
  const lastIndex = candidate.lastIndexOf('}')

  if (firstIndex < 0 || lastIndex < 0 || lastIndex <= firstIndex) {
    throw new Error('Model response did not contain a valid JSON object.')
  }

  const parsed = JSON.parse(candidate.slice(firstIndex, lastIndex + 1))
  return schema.parse(parsed)
}

function extractCodeFenceBody(input: string) {
  const start = input.indexOf('```')
  if (start < 0) {
    return null
  }

  const firstLineBreak = input.indexOf('\n', start + 3)
  if (firstLineBreak < 0) {
    return null
  }

  const end = input.indexOf('```', firstLineBreak + 1)
  if (end < 0 || end <= firstLineBreak) {
    return null
  }

  return input.slice(firstLineBreak + 1, end).trim()
}

function parseRulesFromRawModelOutput(raw: string) {
  try {
    const parsed = parseJsonObject(raw, z.object({
      rules: z.string().min(1),
    }))
    return normalizeText(parsed.rules)
  }
  catch {
    const normalized = raw.trim()
    if (!normalized) {
      return ''
    }

    const candidate = (extractCodeFenceBody(normalized) ?? normalized).trim()

    const quotedRules = candidate.match(/"rules"\s*:\s*"([\s\S]*?)"/i)?.[1]
    if (quotedRules) {
      return normalizeText(quotedRules
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' '))
    }

    return normalizeText(candidate)
  }
}

function isValidHttpUrl(urlValue: string) {
  try {
    const parsed = new URL(urlValue)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

function truncateForPrompt(text: string) {
  if (text.length <= RULES_SAMPLE_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, RULES_SAMPLE_MAX_CHARS)}...`
}

function normalizeRulesSample(text: string) {
  return truncateForPrompt(text.replace(/\s+/g, ' ').trim())
}

function stripInternalFieldSentences(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return normalized
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized]
  const cleaned = sentences
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const lowered = sentence.toLowerCase()
      return !INTERNAL_RULES_TERMS.some(term => lowered.includes(term))
    })

  return cleaned.join(' ').trim()
}

function formatRulesLikePolymarket(text: string) {
  const source = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const stripped = stripInternalFieldSentences(source)
  const normalized = stripped.length >= 30 ? stripped : source

  if (!normalized) {
    return normalized
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map(section => section.trim())
    .filter(Boolean)

  if (sections.length >= 2) {
    return sections.join('\n\n')
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized]
  const chunks: string[] = []
  let current = ''

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim()
    if (!trimmed) {
      return
    }

    const next = current ? `${current} ${trimmed}` : trimmed
    if (next.length > 260 && current) {
      chunks.push(current.trim())
      current = trimmed
      return
    }

    current = next
  })

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks.join('\n\n').trim()
}

function toRulesGenerationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const lowered = message.toLowerCase()

  if (lowered.includes('timeout') || lowered.includes('abort')) {
    return 'AI request timed out. Try again in a few moments.'
  }
  if (lowered.includes('openrouter')) {
    return 'Could not reach OpenRouter. Verify your provider settings and try again.'
  }
  if (lowered.includes('empty')) {
    return 'AI returned empty rules. Add more event context and try again.'
  }
  if (lowered.includes('short')) {
    return 'Generated rules were too short. Add more event context and try again.'
  }
  if (lowered.includes('json') || lowered.includes('format')) {
    return 'AI returned an invalid format. Try again.'
  }

  return 'Could not generate rules with AI right now. Try again in a few moments.'
}

async function fetchGammaRuleSamples(input: {
  mainCategorySlug: string
  marketMode: z.infer<typeof dataSchema>['marketMode']
}): Promise<RulesSample[]> {
  const response = await fetch(GAMMA_MARKETS_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Gamma request failed: ${response.status}`)
  }

  const payload = await response.json().catch(() => [])
  const markets = Array.isArray(payload) ? payload as GammaMarket[] : []
  const mainCategory = input.mainCategorySlug.trim().toLowerCase()

  function isMarketModeCompatible(market: GammaMarket) {
    if (input.marketMode === 'multi_unique') {
      return market.negRisk === true
    }

    if (input.marketMode === 'binary' || input.marketMode === 'multi_multiple') {
      return market.negRisk !== true
    }

    return true
  }

  const selected = markets
    .filter((market) => {
      const description = normalizeText(market.description)
      if (description.length < 80) {
        return false
      }

      if (!isMarketModeCompatible(market)) {
        return false
      }

      if (!mainCategory) {
        return true
      }

      const content = [
        normalizeText(market.question),
        normalizeText(market.description),
        normalizeText(market.events?.[0]?.title),
      ].join(' ').toLowerCase()

      return content.includes(mainCategory)
    })
    .map((market) => {
      const id = normalizeText(market.id) || 'unknown'
      const text = normalizeRulesSample(normalizeText(market.description))
      return { marketId: id, text }
    })
    .filter(item => Boolean(item.text))
    .sort((a, b) => a.marketId.localeCompare(b.marketId))

  const fallback = markets
    .filter(isMarketModeCompatible)
    .map((market) => {
      const id = normalizeText(market.id) || 'unknown'
      const text = normalizeRulesSample(normalizeText(market.description))
      return { marketId: id, text }
    })
    .filter(item => Boolean(item.text))
    .sort((a, b) => a.marketId.localeCompare(b.marketId))

  const base = selected.length > 0 ? selected : fallback
  return base.slice(0, RULES_SAMPLE_LIMIT)
}

function buildMandatoryErrors(input: z.infer<typeof dataSchema>): AiError[] {
  const errors: AiError[] = []
  const categories = normalizeCategoryValues(input)

  if (!normalizeText(input.title)) {
    errors.push({
      code: 'mandatory',
      reason: 'Event title is required.',
      step: 1,
    })
  }

  if (!normalizeText(input.mainCategorySlug)) {
    errors.push({
      code: 'mandatory',
      reason: 'Main category is required.',
      step: 1,
    })
  }

  if (!normalizeText(input.endDateIso)) {
    errors.push({
      code: 'mandatory',
      reason: 'Event end date is required.',
      step: 1,
    })
  }

  if (categories.length < 4) {
    errors.push({
      code: 'mandatory',
      reason: 'At least 4 sub categories are required.',
      step: 1,
    })
  }

  if (!input.marketMode) {
    errors.push({
      code: 'mandatory',
      reason: 'Market type is required.',
      step: 2,
    })
  }
  else if (input.marketMode === 'binary') {
    if (!normalizeText(input.binaryQuestion)) {
      errors.push({
        code: 'mandatory',
        reason: 'Binary question is required.',
        step: 2,
      })
    }

    if (!normalizeText(input.binaryOutcomeYes) || !normalizeText(input.binaryOutcomeNo)) {
      errors.push({
        code: 'mandatory',
        reason: 'Binary outcomes Yes/No are required.',
        step: 2,
      })
    }
  }
  else {
    const validOptions = input.options.filter(option => normalizeText(option.title))
    if (validOptions.length < 2) {
      errors.push({
        code: 'mandatory',
        reason: 'At least 2 options are required for multi-market.',
        step: 2,
      })
    }

    const shortNameMissing = validOptions.some(option => !normalizeText(option.shortName))
    if (shortNameMissing) {
      errors.push({
        code: 'mandatory',
        reason: 'Each option must include a short name.',
        step: 2,
      })
    }

    const questionMissing = validOptions.some(option => !normalizeText(option.question))
    if (questionMissing) {
      errors.push({
        code: 'mandatory',
        reason: 'Each option must include a market question.',
        step: 2,
      })
    }
  }

  if (normalizeText(input.resolutionSource) && !isValidHttpUrl(normalizeText(input.resolutionSource))) {
    errors.push({
      code: 'url',
      reason: `${normalizeText(input.resolutionSource)} is not a valid deterministic resolution URL.`,
      step: 3,
    })
  }

  if (!normalizeText(input.resolutionRules)) {
    errors.push({
      code: 'mandatory',
      reason: 'Resolution rules are required.',
      step: 3,
    })
  }
  else if (normalizeText(input.resolutionRules).length < 60) {
    errors.push({
      code: 'mandatory',
      reason: 'Resolution rules are too short.',
      step: 3,
    })
  }

  return errors
}

function sanitizeAiErrors(errors: AiError[]): AiError[] {
  const deduped = new Map<string, AiError>()
  errors.forEach((error) => {
    const key = `${error.code}:${error.step}:${error.reason}`
    if (!deduped.has(key)) {
      deduped.set(key, error)
    }
  })
  return Array.from(deduped.values())
}

function humanizeAiReason(reason: string) {
  const labels: Record<string, string> = {
    'binaryoutcomes.outcome1': 'Outcome 1',
    'binaryoutcomesoutcome1': 'Outcome 1',
    'binaryoutcomes.outcome2': 'Outcome 2',
    'binaryoutcomesoutcome2': 'Outcome 2',
    'resolutionsourceurl': 'Resolution source URL',
    'resolutionsource': 'Resolution source URL',
    'resolutionrules': 'Resolution rules',
    'maincategoryslug': 'Main category',
    'maincategory': 'Main category',
    'subcategories': 'Sub categories',
    'categories': 'Sub categories',
    'binaryquestion': 'Binary question',
    'binaryoutcomeyes': 'Outcome 1',
    'binaryoutcomeno': 'Outcome 2',
    'marketoptions': 'Market options',
    'options': 'Market options',
    'eventtitle': 'Event title',
    'eventtype': 'Event type',
    'enddateiso': 'End date',
    'enddate': 'End date',
    'shortname': 'Short name',
    'slug': 'Slug',
    'title': 'Event title',
  }

  const tokenPattern = /\b(binaryOutcomes\.?outcome1|binaryOutcomes\.?outcome2|resolutionSourceUrl|resolutionSource|resolutionRules|mainCategorySlug|mainCategory|subCategories|categories|binaryQuestion|binaryOutcomeYes|binaryOutcomeNo|marketOptions|options|eventTitle|eventType|endDateIso|endDate|shortName|slug|title)\b/gi

  const normalized = reason.replace(tokenPattern, (match) => {
    return labels[match.toLowerCase()] ?? match
  })

  return normalized.replace(/\s+/g, ' ').trim()
}

function hasExplicitTimezone(endDateIso: string) {
  const normalized = normalizeText(endDateIso)
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(normalized)
}

function isTimezoneOnlyDateReason(reason: string) {
  const normalized = reason.toLowerCase()
  return (
    normalized.includes('likely utc')
    || normalized.includes('timezone')
    || normalized.includes('time zone')
    || normalized.includes('offset')
    || normalized.includes('local time')
    || /\butc\b/.test(normalized)
    || /\bgmt\b/.test(normalized)
    || /\best\b/.test(normalized)
    || /\bedt\b/.test(normalized)
    || /\bet\b/.test(normalized)
  )
}

export async function GET() {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
    }

    const openRouterSettings = await loadOpenRouterProviderSettings()
    return NextResponse.json({
      configured: Boolean(openRouterSettings.apiKey),
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const openRouterSettings = await loadOpenRouterProviderSettings()
    if (!openRouterSettings.apiKey) {
      return NextResponse.json({ error: 'OpenRouter is not configured.' }, { status: 400 })
    }

    const { mode, data } = parsed.data
    const apiKey = openRouterSettings.apiKey
    const model = openRouterSettings.model

    if (mode === 'generate_rules') {
      let samples: RulesSample[] = []
      try {
        try {
          samples = await fetchGammaRuleSamples({
            mainCategorySlug: normalizeText(data.mainCategorySlug),
            marketMode: data.marketMode,
          })
        }
        catch (sampleError) {
          console.warn('Gamma samples unavailable, continuing without them:', sampleError)
        }

        const sampleText = samples.length > 0
          ? samples.map(sample => `- [${sample.marketId}] ${sample.text}`).join('\n')
          : '- No external samples available.'

        const promptPayload = {
          title: normalizeText(data.title),
          endDateIso: normalizeText(data.endDateIso),
          marketMode: data.marketMode,
          mainCategorySlug: normalizeText(data.mainCategorySlug),
          categories: normalizeCategoryValues(data),
          binaryQuestion: normalizeText(data.binaryQuestion),
          binaryOutcomeYes: normalizeText(data.binaryOutcomeYes),
          binaryOutcomeNo: normalizeText(data.binaryOutcomeNo),
          options: data.options.map(option => ({
            question: normalizeText(option.question),
            title: normalizeText(option.title),
            shortName: normalizeText(option.shortName),
          })),
          resolutionSource: normalizeText(data.resolutionSource),
        }

        const messages: OpenRouterMessage[] = [
          {
            role: 'system',
            content: [
              'You are a prediction market rules writer following Polymarket style.',
              'Return only JSON with key "rules".',
              'Rules must be in English, objective, deterministic, and concise.',
              'Write 2-4 short paragraphs separated by blank lines.',
              'Paragraph 1: exact Yes/No resolution condition and UTC cutoff based on End date.',
              'Paragraph 2: resolution source and source precedence.',
              'Paragraph 3: objective edge-case handling (delays/revisions/cancellations) without arbitrary fallback to No.',
              'Do not invent random timestamps unrelated to End date.',
              'Do not mention form/backend/internal field names.',
              'Never include terms like marketMode, binaryQuestion, multi_multiple, options array, endDateIso.',
              'Do not include markdown.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Market draft:\n${JSON.stringify(promptPayload, null, 2)}`,
              '',
              'Reference rules from Polymarket Gamma samples:',
              sampleText,
              '',
              'Output format:',
              '{"rules":"..."}',
            ].join('\n'),
          },
        ]

        const raw = await requestOpenRouterCompletion(messages, {
          apiKey,
          model,
          temperature: 0,
          maxTokens: 600,
        })

        const extractedRules = parseRulesFromRawModelOutput(raw)
        if (!extractedRules) {
          throw new Error('Generated rules are empty.')
        }

        const formattedRules = formatRulesLikePolymarket(extractedRules)
        const finalRules = formattedRules.length >= RULES_MIN_LENGTH
          ? formattedRules
          : extractedRules

        if (finalRules.length < RULES_MIN_LENGTH) {
          throw new Error('Generated rules are too short.')
        }

        return NextResponse.json({
          rules: finalRules,
          samplesUsed: samples.length,
        })
      }
      catch (error) {
        console.error('AI rules generation error:', error)
        return NextResponse.json({
          error: toRulesGenerationErrorMessage(error),
        }, { status: 502 })
      }
    }

    const localErrors = sanitizeAiErrors(buildMandatoryErrors(data))
    const mandatoryOk = localErrors.length === 0

    if (!mandatoryOk) {
      return NextResponse.json({
        ok: false,
        checks: {
          mandatory: false,
          language: false,
          deterministic: false,
        },
        errors: localErrors,
      })
    }

    const normalizedOptions = data.marketMode === 'binary'
      ? []
      : data.options.map(option => ({
          question: normalizeText(option.question),
          title: normalizeText(option.title),
          shortName: normalizeText(option.shortName),
        }))

    const aiInput = {
      eventTitle: normalizeText(data.title),
      endDate: normalizeText(data.endDateIso),
      mainCategory: normalizeText(data.mainCategorySlug),
      subCategories: normalizeCategoryValues(data),
      eventType: data.marketMode,
      binaryQuestion: normalizeText(data.binaryQuestion),
      binaryOutcomes: {
        outcome1: normalizeText(data.binaryOutcomeYes),
        outcome2: normalizeText(data.binaryOutcomeNo),
      },
      marketOptions: normalizedOptions,
      resolutionSourceUrl: normalizeText(data.resolutionSource),
      resolutionRules: normalizeText(data.resolutionRules),
    }

    const checkMessages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: [
          'You are a strict validator for prediction market content.',
          'Return only JSON.',
          'Ignore proper nouns (people, places, country names, organizations) when checking English.',
          'Resolution source URL is optional. Only flag URL errors if it is provided and invalid.',
          'Validate event endDate consistency with the event context by calendar day first (YYYY-MM-DD).',
          'Ignore timezone-only differences (for example UTC vs ET) and small intra-day offsets.',
          'Return a date error only when day/month/year clearly conflicts with a reliable public date.',
          'If the public date is unknown or uncertain, do not guess and do not flag date.',
          'Flag only real language errors or deterministic logic issues.',
          'Reject content that could encourage, normalize, or financially incentivize real-world harm (violence, death, war, terrorism, or self-harm); return a "rules" error with a brief safety reason.',
          'Use user-facing field names in reasons (for example "End date", "Event title", "Resolution source URL"), never backend field keys.',
          'Output format: {"ok":boolean,"errors":[{"code":"english|url|rules|mandatory|date","reason":"...","step":1|2|3}]}',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify(aiInput, null, 2),
      },
    ]

    const rawResult = await requestOpenRouterCompletion(checkMessages, {
      apiKey,
      model,
      temperature: 0,
      maxTokens: 500,
    })

    const aiResult = parseJsonObject(rawResult, aiContentCheckSchema)
    const endDateHasTimezone = hasExplicitTimezone(data.endDateIso)
    const aiErrors = sanitizeAiErrors(aiResult.errors.map(error => ({
      code: error.code,
      reason: humanizeAiReason(error.reason),
      step: error.step as 1 | 2 | 3,
    })))
      .filter((error) => {
        if (data.marketMode !== 'binary') {
          return true
        }

        const reason = error.reason.toLowerCase()
        return !(
          reason.includes('market options')
          || reason.includes('short name')
          || reason.includes('options array')
        )
      })
      .filter((error) => {
        if (error.code !== 'date') {
          return true
        }
        if (endDateHasTimezone) {
          return true
        }
        return !isTimezoneOnlyDateReason(error.reason)
      })

    const errors = sanitizeAiErrors([...localErrors, ...aiErrors])

    return NextResponse.json({
      ok: errors.length === 0,
      checks: {
        mandatory: true,
        language: !errors.some(error => error.code === 'english'),
        deterministic: !errors.some(error => error.code === 'rules' || error.code === 'url'),
      },
      errors,
    })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
