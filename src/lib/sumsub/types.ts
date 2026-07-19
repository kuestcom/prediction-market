export const SUMSUB_ENFORCEMENTS = ['disabled', 'observe', 'required'] as const
export type SumsubEnforcement = typeof SUMSUB_ENFORCEMENTS[number]
export type SumsubStatus = 'not_started' | 'pending' | 'on_hold' | 'approved' | 'rejected' | 'error'

export interface PublicSumsubSettings {
  enabled: boolean
  configured: boolean
  effective: boolean
  enforcement: SumsubEnforcement
  levelName: string
}

export interface SumsubVerificationStatus extends PublicSumsubSettings {
  status: SumsubStatus
  approvedAt: string | null
  updatedAt: string | null
}
