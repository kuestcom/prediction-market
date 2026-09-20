import resolveSiteUrl from '@/lib/site-url'
import { loadRuntimeThemeSiteName } from '@/lib/theme-settings'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterModelInfo {
  id: string
  name?: string
  description?: string
  context_length?: number
  context_window?: number
  supported_parameters?: string[]
  category?: string
  type?: string
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
  }
}

interface OpenRouterChoice {
  message: {
    role: 'assistant'
    content: string
  }
  finish_reason?: string | null
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[]
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelInfo[]
}

type OpenRouterDecisionQuestion =
  | {
      type: 'choice'
      instructions: string
      criteria: Record<string, string>
    }
  | {
      type: 'noul'
      instructions: string
      criteria?: {
        true: string
        false: string
      }
    }
  | {
      type: 'score'
      instructions: string
      criteria: string[]
    }

export interface OpenRouterDecisionRequest {
  model: string
  state: Record<string, unknown>
  questions: Record<string, OpenRouterDecisionQuestion>
}

interface OpenRouterDecisionAnswer {
  type?: string
  choice?: string
  noul?: number
  score?: number
  confidence?: number
  probabilities?: Record<string, number>
}

export interface OpenRouterDecisionResponse {
  answers: Record<string, OpenRouterDecisionAnswer>
  id?: string
  model?: string
  provider?: string
  usage?: Record<string, unknown>
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_DECISIONS_API_URL = 'https://openrouter.ai/api/alpha/decisions'
const OPENROUTER_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const OPENROUTER_WEB_SEARCH_PARAMETER = 'web_search_options'
const OPENROUTER_DECISION_MODEL_FALLBACKS: OpenRouterModelSummary[] = [
  { id: '~typesafe/jev-latest', name: 'TypeSafe Jev Latest' },
  { id: 'typesafe/jev-1.13', name: 'TypeSafe Jev 1.13' },
]
const inFlightOpenRouterModelInfo = new Map<string, Promise<OpenRouterModelInfo[]>>()

function sanitizeOpenRouterTitle(value: string) {
  const withoutDiacritics = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return withoutDiacritics.replace(/[^\x20-\x7e]/g, '').trim()
}

interface RequestCompletionOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  apiKey?: string
  timeoutMs?: number
  webSearch?: boolean
  webSearchContextSize?: 'low' | 'medium' | 'high'
}

async function buildOpenRouterHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    headers['HTTP-Referer'] = resolveSiteUrl(process.env)
  }

  const siteName = await loadRuntimeThemeSiteName()
  const openRouterTitle = siteName ? sanitizeOpenRouterTitle(siteName) : ''
  if (openRouterTitle) {
    headers['X-OpenRouter-Title'] = openRouterTitle
  }

  return headers
}

export async function requestOpenRouterCompletion(messages: OpenRouterMessage[], options?: RequestCompletionOptions) {
  const apiKey = options?.apiKey
  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured.')
  }

  const model = options?.model
  const headers = await buildOpenRouterHeaders(apiKey)

  const requestBody = {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 600,
    ...(options?.webSearch
      ? {
          web_search_options: {
            search_context_size: options.webSearchContextSize ?? 'medium',
          },
        }
      : {}),
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(options?.timeoutMs ?? 45_000),
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter request failed: ${response.status} ${errorBody}`)
  }

  const completion = (await response.json()) as OpenRouterResponse
  const choice = completion.choices[0]
  const content = choice?.message?.content

  if (choice?.finish_reason === 'length') {
    throw new Error('OpenRouter response was truncated because it reached max_tokens.')
  }

  if (!content) {
    throw new Error('OpenRouter response did not contain any content.')
  }

  return content.trim()
}

export async function requestOpenRouterDecisions(
  request: OpenRouterDecisionRequest,
  options?: { apiKey?: string; timeoutMs?: number },
): Promise<OpenRouterDecisionResponse> {
  const apiKey = options?.apiKey
  if (!apiKey) {
    throw new Error('OpenRouter API key is not configured.')
  }

  const headers = await buildOpenRouterHeaders(apiKey)
  headers.Accept = 'application/json'
  const response = await fetch(OPENROUTER_DECISIONS_API_URL, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(options?.timeoutMs ?? 12_000),
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter decisions request failed: ${response.status} ${errorBody}`)
  }

  const decisions = (await response.json()) as OpenRouterDecisionResponse
  if (!decisions || !decisions.answers || typeof decisions.answers !== 'object') {
    throw new Error('OpenRouter decisions response did not contain any answers.')
  }

  return decisions
}

export function sanitizeForPrompt(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ')?.trim() ?? 'Not provided'
}

export interface OpenRouterModelSummary {
  id: string
  name: string
  contextLength?: number
}

function isTransientOpenRouterFetchError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const err = error as { name?: string; message?: string }
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return true
  }

  const message = err.message?.toLowerCase() ?? ''
  return message.includes('timed out') || message.includes('timeout')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function supportsOpenRouterWebSearch(model: OpenRouterModelInfo) {
  return (
    Array.isArray(model.supported_parameters) && model.supported_parameters.includes(OPENROUTER_WEB_SEARCH_PARAMETER)
  )
}

function isOpenRouterDecisionModel(model: OpenRouterModelInfo) {
  const normalizedId = model.id.replace(/^~/, '').toLowerCase()
  if (normalizedId.startsWith('typesafe/jev')) {
    return true
  }

  const modelType = [
    model.category,
    model.type,
    model.architecture?.modality,
    ...(model.architecture?.output_modalities ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return modelType.includes('decision')
}

async function fetchOpenRouterModelInfoUncached(apiKey: string): Promise<OpenRouterModelInfo[]> {
  const headers = await buildOpenRouterHeaders(apiKey)
  let payload: OpenRouterModelsResponse | null = null
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(OPENROUTER_MODELS_API_URL, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        const isRetryableStatus = OPENROUTER_RETRYABLE_STATUS.has(response.status)

        if (isRetryableStatus && attempt < 2) {
          await sleep(350)
          continue
        }

        throw new Error(`OpenRouter models request failed: ${response.status} ${errorBody}`)
      }

      payload = (await response.json()) as OpenRouterModelsResponse
      break
    } catch (error) {
      if (isTransientOpenRouterFetchError(error) && attempt < 2) {
        await sleep(350)
        continue
      }

      lastError = error instanceof Error ? error : new Error(String(error))
      break
    }
  }

  if (!payload) {
    if (lastError) {
      throw lastError
    }
    throw new Error('OpenRouter models request failed: empty response')
  }

  return Array.isArray(payload.data) ? payload.data : []
}

function fetchOpenRouterModelInfo(apiKey: string): Promise<OpenRouterModelInfo[]> {
  if (!apiKey) {
    return Promise.resolve([])
  }

  const existingRequest = inFlightOpenRouterModelInfo.get(apiKey)
  if (existingRequest) {
    return existingRequest
  }

  const request = fetchOpenRouterModelInfoUncached(apiKey)
  inFlightOpenRouterModelInfo.set(apiKey, request)

  void request.then(
    () => {
      if (inFlightOpenRouterModelInfo.get(apiKey) === request) {
        inFlightOpenRouterModelInfo.delete(apiKey)
      }
    },
    () => {
      if (inFlightOpenRouterModelInfo.get(apiKey) === request) {
        inFlightOpenRouterModelInfo.delete(apiKey)
      }
    },
  )

  return request
}

function toOpenRouterModelSummary(model: OpenRouterModelInfo): OpenRouterModelSummary {
  const contextLength =
    typeof model.context_length === 'number'
      ? model.context_length
      : typeof model.context_window === 'number'
        ? model.context_window
        : undefined

  return {
    id: model.id,
    name: model.name || model.id,
    contextLength,
  }
}

function sortOpenRouterModels(models: OpenRouterModelSummary[]) {
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  const models = await fetchOpenRouterModelInfo(apiKey)

  return sortOpenRouterModels(models.filter(supportsOpenRouterWebSearch).map(toOpenRouterModelSummary))
}

export async function fetchAllOpenRouterModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  const models = await fetchOpenRouterModelInfo(apiKey)

  return sortOpenRouterModels(models.map(toOpenRouterModelSummary))
}

export async function fetchOpenRouterDecisionModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  const models = await fetchOpenRouterModelInfo(apiKey)
  const decisionModels = models.filter(isOpenRouterDecisionModel).map(toOpenRouterModelSummary)

  return sortOpenRouterModels(decisionModels.length > 0 ? decisionModels : [...OPENROUTER_DECISION_MODEL_FALLBACKS])
}
