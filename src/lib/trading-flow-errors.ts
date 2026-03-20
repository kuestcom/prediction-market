import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

export const DEFAULT_PROXY_WALLET_DEPLOY_ERROR_MESSAGE = 'Could not deploy your proxy wallet right now. Please try again in a few moments.'
export const DEFAULT_TRADING_AUTH_ERROR_MESSAGE = 'Could not enable trading right now. Please try again in a few moments.'
export const DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE = 'Could not approve tokens right now. Please try again in a few moments.'

const COMMON_TRADING_ERROR_MESSAGES: Record<string, string> = {
  owner_address_mismatch: 'Your trading session is out of sync. Reconnect and try again.',
  owner_mismatch: 'Your trading session is out of sync. Reconnect and try again.',
  invalid_l2: 'Your trading session expired. Please sign in again.',
}

const COMMON_TRANSPORT_ERROR_PATTERNS: Array<{ pattern: RegExp, message: string }> = [
  {
    pattern: /\b(gas price below minimum|gas tip cap .*minimum needed|transaction underpriced|replacement transaction underpriced|max fee per gas less than block base fee|fee cap less than block base fee|wallet_transport_error|transport error|timeout waiting for relay|bad gateway|gateway timeout)\b/i,
    message: '',
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function looksLikeHtmlDocument(value: string | null | undefined) {
  if (!value) {
    return false
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  return /^<!doctype html\b/i.test(trimmed) || /^<html\b/i.test(trimmed) || /<html[\s>]/i.test(trimmed)
}

export function getTradingFlowErrorPreview(value: string | null | undefined, maxLength = 300) {
  if (!value) {
    return null
  }

  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed || looksLikeHtmlDocument(trimmed)) {
    return null
  }

  return trimmed.slice(0, maxLength)
}

export async function readTradingFlowErrorResponse(response: Response) {
  const responseForText = response.clone()
  const contentType = response.headers.get('content-type')

  const parsed = await response.json().catch(() => null)
  const payload = isRecord(parsed) ? parsed : null

  const payloadError = typeof payload?.error === 'string'
    ? payload.error
    : typeof payload?.message === 'string'
      ? payload.message
      : null

  let textError: string | null = null
  if (!payloadError) {
    try {
      const text = await responseForText.text()
      textError = text.trim().slice(0, 300) || null
    }
    catch {
      textError = null
    }
  }

  return {
    payload,
    rawError: payloadError ?? textError,
    contentType,
  }
}

function mapTradingFlowError(
  rawError: string | null | undefined,
  options: {
    status?: number | null
    contentType?: string | null
    fallbackMessage: string
    exactMessages?: Record<string, string>
    forceFallback?: boolean
  },
) {
  if (options.forceFallback) {
    return options.fallbackMessage
  }

  const normalized = getTradingFlowErrorPreview(rawError)
  if (normalized) {
    const lowered = normalized.toLowerCase()
    const exactMessages = {
      ...COMMON_TRADING_ERROR_MESSAGES,
      ...(options.exactMessages ?? {}),
    }
    const exactMatch = exactMessages[lowered]
    if (exactMatch) {
      return exactMatch
    }

    for (const { pattern } of COMMON_TRANSPORT_ERROR_PATTERNS) {
      if (pattern.test(lowered)) {
        return options.fallbackMessage
      }
    }
  }

  const normalizedContentType = options.contentType?.toLowerCase() ?? null
  if (
    looksLikeHtmlDocument(rawError)
    || normalizedContentType?.includes('text/html')
    || (typeof options.status === 'number' && options.status >= 500)
  ) {
    return options.fallbackMessage
  }

  return normalized ?? DEFAULT_ERROR_MESSAGE
}

export function mapProxyWalletDeployError(
  rawError: string | null | undefined,
  options: { status?: number | null, contentType?: string | null, forceFallback?: boolean } = {},
) {
  return mapTradingFlowError(rawError, {
    ...options,
    fallbackMessage: DEFAULT_PROXY_WALLET_DEPLOY_ERROR_MESSAGE,
    exactMessages: {
      wallet_service_disabled: 'Proxy wallet deployment is temporarily unavailable right now.',
    },
  })
}

export function mapTradingAuthError(
  rawError: string | null | undefined,
  options: { status?: number | null, contentType?: string | null, forceFallback?: boolean } = {},
) {
  return mapTradingFlowError(rawError, {
    ...options,
    fallbackMessage: DEFAULT_TRADING_AUTH_ERROR_MESSAGE,
    exactMessages: {
      wallet_service_disabled: 'Trading is temporarily unavailable right now.',
    },
  })
}

export function mapApproveTokensError(
  rawError: string | null | undefined,
  options: { status?: number | null, contentType?: string | null, forceFallback?: boolean } = {},
) {
  return mapTradingFlowError(rawError, {
    ...options,
    fallbackMessage: DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE,
    exactMessages: {
      wallet_service_disabled: 'Token approvals are temporarily unavailable right now.',
    },
  })
}
