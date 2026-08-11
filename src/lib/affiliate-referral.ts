export type ReferralSetupStatus = 'not-required' | 'checking' | 'required' | 'configured'

export function resolveReferralSetupStatus(results: Array<boolean | null>): ReferralSetupStatus {
  if (results.some((result) => result !== true)) {
    return 'required'
  }
  if (results.length > 0 && results.every((result) => result === true)) {
    return 'configured'
  }
  return 'not-required'
}
