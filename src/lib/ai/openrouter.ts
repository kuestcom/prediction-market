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

export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModelSummary[]> {
  if (!apiKey) {
    return []
  }

  const headers = await buildOpenRouterHeaders(apiKey)

  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenRouter models request failed: ${response.status} ${errorBody}`)
  }

  const payload = (await response.json()) as OpenRouterModelsResponse
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
