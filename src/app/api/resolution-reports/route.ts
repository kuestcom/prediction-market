import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'
import { getAddress, isAddress, recoverMessageAddress } from 'viem'

import { ResolutionReportRepository } from '@/lib/db/queries/resolution-report'
import { UserRepository } from '@/lib/db/queries/user'
import { isDirectResolutionConfiguration } from '@/lib/direct-resolution'
import { buildResolutionReportMessage, isResolutionReportOutcome } from '@/lib/resolution-report'
import { isEligibleToReportResolution } from '@/lib/resolution-report-eligibility'

const MAX_BODY_BYTES = 4_096
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1_000
const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1_000
const SIGNATURE_PATTERN = /^0x[\da-f]{130}$/i
const NONCE_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const ALLOWED_BODY_KEYS = new Set([
  'conditionId',
  'eventId',
  'issuedAt',
  'nonce',
  'outcome',
  'reporterAddress',
  'signature',
])

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

async function resolveEligibility(user: { address?: string | null; deposit_wallet_address?: string | null } | null) {
  if (!user?.address || !isAddress(user.address)) {
    return 'signed_out' as const
  }

  const tradingAddress =
    user.deposit_wallet_address && isAddress(user.deposit_wallet_address) ? user.deposit_wallet_address : user.address
  try {
    return (await isEligibleToReportResolution(tradingAddress)) ? ('eligible' as const) : ('ineligible' as const)
  } catch (error) {
    console.error('Resolution report eligibility check failed:', error)
    return 'unavailable' as const
  }
}

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get('conditionId')?.trim() ?? ''
  const includeEligibility = request.nextUrl.searchParams.get('includeEligibility') === 'true'
  if (!conditionId || conditionId.length > 128) {
    return jsonError('Invalid market.', 'invalid_market', 400)
  }

  try {
    const target = await ResolutionReportRepository.getTarget(conditionId)
    if (!target || !isDirectResolutionConfiguration(target)) {
      return jsonError('Market not found.', 'market_not_found', 404)
    }

    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    const summary = await ResolutionReportRepository.getPublicSummary(conditionId, currentUser?.id)
    const eligibility = includeEligibility ? await resolveEligibility(currentUser) : 'unavailable'

    return NextResponse.json({
      ...summary,
      eligibility,
    })
  } catch (error) {
    console.error('Could not load resolution report summary:', error)
    return jsonError('Could not load resolution proposals.', 'summary_unavailable', 500)
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError('Request is too large.', 'request_too_large', 413)
  }

  const currentUser = await UserRepository.getCurrentUser()
  if (!currentUser?.id || !currentUser.address || !isAddress(currentUser.address)) {
    return jsonError('Authentication required.', 'authentication_required', 401)
  }

  let body: Record<string, unknown>
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonError('Request is too large.', 'request_too_large', 413)
    }
    const parsed = JSON.parse(rawBody) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => !ALLOWED_BODY_KEYS.has(key))
    ) {
      return jsonError('Invalid request.', 'invalid_request', 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return jsonError('Invalid request.', 'invalid_request', 400)
  }

  const conditionId = typeof body.conditionId === 'string' ? body.conditionId.trim() : ''
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : ''
  const reporterAddress = typeof body.reporterAddress === 'string' ? body.reporterAddress.trim() : ''
  const issuedAt = typeof body.issuedAt === 'string' ? body.issuedAt.trim() : ''
  const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : ''
  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  const outcome = body.outcome

  if (
    !conditionId ||
    conditionId.length > 128 ||
    !eventId ||
    eventId.length > 26 ||
    !isAddress(reporterAddress) ||
    !isResolutionReportOutcome(outcome) ||
    !SIGNATURE_PATTERN.test(signature) ||
    !NONCE_PATTERN.test(nonce)
  ) {
    return jsonError('Invalid request.', 'invalid_request', 400)
  }

  const signedAt = new Date(issuedAt)
  const signedAtTimestamp = signedAt.getTime()
  const now = Date.now()
  if (
    !Number.isFinite(signedAtTimestamp) ||
    now - signedAtTimestamp > MAX_SIGNATURE_AGE_MS ||
    signedAtTimestamp - now > MAX_FUTURE_CLOCK_SKEW_MS
  ) {
    return jsonError('Signature expired. Try again.', 'signature_expired', 400)
  }

  const sessionAddress = getAddress(currentUser.address)
  if (getAddress(reporterAddress) !== sessionAddress) {
    return jsonError('Connected wallet does not match the signed-in account.', 'wallet_mismatch', 403)
  }

  try {
    const target = await ResolutionReportRepository.getTarget(conditionId)
    if (!target || target.eventId !== eventId || !isDirectResolutionConfiguration(target)) {
      return jsonError('Market not found.', 'market_not_found', 404)
    }
    if (!target.marketActive || target.eventStatus !== 'active' || target.marketResolved || target.conditionResolved) {
      return jsonError('This market is already resolved.', 'market_resolved', 409)
    }
    if (target.negRisk && outcome === 'unknown') {
      return jsonError('Unknown is not available for this market.', 'invalid_outcome', 400)
    }

    const eligibility = await resolveEligibility(currentUser)
    if (eligibility === 'unavailable') {
      return jsonError('Eligibility could not be checked right now.', 'eligibility_unavailable', 503)
    }
    if (eligibility !== 'eligible') {
      return jsonError('This account is not eligible to propose a resolution.', 'not_eligible', 403)
    }

    const message = buildResolutionReportMessage({
      conditionId,
      eventId,
      issuedAt: signedAt.toISOString(),
      nonce,
      outcome,
      reporterAddress: sessionAddress,
    })
    let recoveredAddress: string
    try {
      recoveredAddress = await recoverMessageAddress({ message, signature: signature as `0x${string}` })
    } catch {
      return jsonError('Invalid wallet signature.', 'invalid_signature', 401)
    }
    if (recoveredAddress.toLowerCase() !== sessionAddress.toLowerCase()) {
      return jsonError('Invalid wallet signature.', 'invalid_signature', 401)
    }

    const report = await ResolutionReportRepository.upsert({
      conditionId,
      eventId,
      userId: currentUser.id,
      reporterAddress: sessionAddress,
      outcome,
      signature,
      nonce,
      signedAt,
    })
    if (!report) {
      throw new Error('Resolution report was not stored.')
    }

    return NextResponse.json({
      id: report.id,
      outcome: report.outcome,
      updatedAt: report.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Could not submit resolution report:', error)
    return jsonError('Could not submit resolution proposal.', 'submission_failed', 500)
  }
}
