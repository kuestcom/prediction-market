export type ReferralSetupStatus = 'not-required' | 'checking' | 'required' | 'configured'

export interface ReferralExchangeReadResult<T> {
  exchangesToConfigure: T[]
  fullyChecked: boolean
}

export function resolveReferralSetupStatus(results: Array<boolean | null>): ReferralSetupStatus {
  if (results.some((result) => result !== true)) {
    return 'required'
  }
  if (results.length > 0 && results.every((result) => result === true)) {
    return 'configured'
  }
  return 'not-required'
}

export function resolveReferralExchangeReads<T>(
  exchanges: readonly T[],
  results: Array<boolean | null>,
): ReferralExchangeReadResult<T> {
  return {
    exchangesToConfigure: exchanges.filter((_, index) => results[index] === false),
    fullyChecked: results.length === exchanges.length && results.every((result) => result !== null),
  }
}
