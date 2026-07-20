import type { SumsubStatus } from './types'

import { createHmac } from 'node:crypto'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'
import 'server-only'

const SUMSUB_BASE_URL = 'https://api.sumsub.com'
const RESPONSE_LIMIT = 64 * 1024
const REQUEST_TIMEOUT_MS = 10_000

export class SumsubClientError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message)
  }
}

interface SumsubCredentials {
  appToken: string
  secretKey: string
}

export interface SumsubApplicantSummary {
  id: string
  externalUserId?: string
  levelName?: string
  review?: { reviewStatus?: string, reviewResult?: { reviewAnswer?: string } }
}

export function normalizeSumsubApplicantStatus(applicant: SumsubApplicantSummary): SumsubStatus {
  const answer = applicant.review?.reviewResult?.reviewAnswer
  if (answer === 'GREEN') {
    return 'approved'
  }
  if (answer === 'RED') {
    return 'rejected'
  }
  const status = applicant.review?.reviewStatus?.toLowerCase() ?? ''
  if (status.includes('hold')) {
    return 'on_hold'
  }
  if (status) {
    return 'pending'
  }
  return 'not_started'
}

function normalizeResponseError(status: number) {
  if (status === 401 || status === 403) {
    return 'Sumsub credentials were rejected.'
  }
  if (status === 404) {
    return 'The requested Sumsub resource was not found.'
  }
  if (status === 429) {
    return 'Sumsub rate limit reached. Try again shortly.'
  }
  return 'Sumsub is temporarily unavailable.'
}

export class SumsubClient {
  constructor(private readonly credentials: SumsubCredentials) {}

  buildSignature(timestamp: number, method: string, pathWithQuery: string, body = '') {
    return createHmac('sha256', this.credentials.secretKey)
      .update(`${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`)
      .digest('hex')
  }

  private async request<T>(method: string, pathWithQuery: string, input?: unknown, allowNotFound = false): Promise<T | null> {
    const body = input === undefined ? '' : JSON.stringify(input)
    const timestamp = Math.floor(Date.now() / 1000)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${SUMSUB_BASE_URL}${pathWithQuery}`, {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': this.credentials.appToken,
          'X-App-Access-Ts': String(timestamp),
          'X-App-Access-Sig': this.buildSignature(timestamp, method, pathWithQuery, body),
        },
        body: body || undefined,
      })
      if (allowNotFound && response.status === 404) {
        return null
      }
      if (!response.ok) {
        throw new SumsubClientError(normalizeResponseError(response.status), response.status)
      }
      if (!response.body) {
        return null
      }
      const responseBytes = await readResponseBodyWithLimit(response, RESPONSE_LIMIT)
      if (!responseBytes) {
        throw new SumsubClientError('Sumsub returned an invalid response.')
      }
      const text = new TextDecoder().decode(responseBytes)
      return text ? JSON.parse(text) as T : null
    }
    catch (error) {
      if (error instanceof SumsubClientError) {
        throw error
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SumsubClientError('Sumsub connection timed out.', 504)
      }
      throw new SumsubClientError('Sumsub is temporarily unavailable.')
    }
    finally {
      clearTimeout(timeout)
    }
  }

  async getApplicantByExternalUserId(externalUserId: string) {
    return this.request<SumsubApplicantSummary>(
      'GET',
      `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`,
      undefined,
      true,
    )
  }

  async createAccessToken(externalUserId: string, levelName: string) {
    const result = await this.request<{ token: string, userId: string }>('POST', '/resources/accessTokens/sdk', {
      ttlInSecs: 600,
      userId: externalUserId,
      levelName,
    })
    if (!result?.token || result.token.length > 1024 || result.userId !== externalUserId) {
      throw new SumsubClientError('Sumsub returned an invalid access token.')
    }
    return result.token
  }

  async moveApplicantToLevel(applicantId: string, levelName: string) {
    await this.request(
      'POST',
      `/resources/applicants/${encodeURIComponent(applicantId)}/moveToLevel?name=${encodeURIComponent(levelName)}`,
    )
  }

  async testConnection(levelName: string) {
    const externalUserId = `connection-test-${crypto.randomUUID()}`
    await this.createAccessToken(externalUserId, levelName)
  }
}
