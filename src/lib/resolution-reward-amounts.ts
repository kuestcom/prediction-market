import { baseUnitsToNumber } from '@/lib/data-api/fees'

const RESOLUTION_REWARD_TOKEN_DECIMALS = 6

export function resolutionRewardBaseUnitsToNumber(value: bigint | string): number {
  try {
    return baseUnitsToNumber(BigInt(value), RESOLUTION_REWARD_TOKEN_DECIMALS)
  } catch {
    return 0
  }
}
