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
}

interface OpenRouterChoice {
  message: {
    role: 'assistant'
    content: string
  }
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[]
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelInfo[]
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

interface RequestCompletionOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  apiKey?: string
}

async function buildOpenRouterHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }

  if (process.env.SITE_URL) {
    headers['HTTP-Referer'] = process.env.SITE_URL
  }

  const siteName = await loadRuntimeThemeSiteName()
  if (siteName) {
    headers['X-Title'] = siteName
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

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 600,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter request failed: ${response.status} ${errorBody}`)
  }

  const completion = (await response.json()) as OpenRouterResponse
  const content = completion.choices[0]?.message?.content

  if (!content) {
    throw new Error('OpenRouter response did not contain any content.')
  }

  return content.trim()
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

  const err = error as { name?: string, message?: string }
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return true
  }

  const message = err.message?.toLowerCase() ?? ''
  return message.includes('timed out') || message.includes('timeout')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  if (!apiKey) {
    return []
  }

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
    }
    catch (error) {
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

  const models = Array.isArray(payload.data) ? payload.data : []

  return models
    .map<OpenRouterModelSummary>((model) => {
      const contextLength = typeof model.context_length === 'number'
        ? model.context_length
        : typeof model.context_window === 'number'
          ? model.context_window
          : undefined
      return {
        id: model.id,
        name: model.name || model.id,
        contextLength,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
