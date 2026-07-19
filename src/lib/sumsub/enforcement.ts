import { SumsubRepository } from '@/lib/db/queries/sumsub'

import { getSumsubSettings } from './settings'
import 'server-only'

export const SUMSUB_APPROVAL_REQUIRED_CODE = 'SUMSUB_APPROVAL_REQUIRED'
export const SUMSUB_APPROVAL_REQUIRED_MESSAGE = 'Complete identity verification to continue.'

async function getSumsubTradingAccess(userId: string) {
  const settings = await getSumsubSettings()
  if (!settings.enabled || !settings.configured || settings.enforcement !== 'required') {
    return { allowed: true as const, code: null, settings }
  }

  const applicant = await SumsubRepository.getForUser(userId)
  const allowed = applicant?.level_name === settings.levelName && applicant.status === 'approved'
  return allowed
    ? { allowed: true as const, code: null, settings }
    : { allowed: false as const, code: SUMSUB_APPROVAL_REQUIRED_CODE, settings }
}

export async function requireSumsubTradingApproval(userId: string) {
  try {
    return await getSumsubTradingAccess(userId)
  }
  catch {
    return {
      allowed: false as const,
      code: SUMSUB_APPROVAL_REQUIRED_CODE,
      settings: null,
    }
  }
}
