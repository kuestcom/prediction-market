import type { DirectResolutionOutcome } from '@/lib/direct-resolution'

export interface ResolutionReportMessageInput {
  conditionId: string
  eventId: string
  issuedAt: string
  nonce: string
  outcome: DirectResolutionOutcome
  reporterAddress: string
}

export function buildResolutionReportMessage(input: ResolutionReportMessageInput) {
  return [
    'Kuest Market Resolution Proposal',
    `Event: ${input.eventId}`,
    `Market: ${input.conditionId}`,
    `Outcome: ${input.outcome}`,
    `Reporter: ${input.reporterAddress.toLowerCase()}`,
    `Issued at: ${input.issuedAt}`,
    `Nonce: ${input.nonce}`,
  ].join('\n')
}

export function isResolutionReportOutcome(value: unknown): value is DirectResolutionOutcome {
  return value === 'yes' || value === 'no' || value === 'unknown'
}

export function isResolutionReportCorrect(
  proposedOutcome: DirectResolutionOutcome,
  yesPayout: number | null,
  noPayout: number | null,
) {
  if (yesPayout == null || noPayout == null || !Number.isFinite(yesPayout) || !Number.isFinite(noPayout)) {
    return null
  }

  if (Math.abs(yesPayout - noPayout) < Number.EPSILON) {
    return proposedOutcome === 'unknown'
  }

  return proposedOutcome === (yesPayout > noPayout ? 'yes' : 'no')
}
