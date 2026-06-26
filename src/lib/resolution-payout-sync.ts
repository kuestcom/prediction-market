import { and, eq, isNull, ne, or } from 'drizzle-orm'
import { createPublicClient, http, parseAbi } from 'viem'
import { CONDITIONAL_TOKENS_CONTRACT } from '@/lib/contracts'
import { conditions as conditionsTable, outcomes as outcomesTable } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { defaultViemNetwork, resolveRuntimeViemRpcUrl } from '@/lib/viem-network'

const BINARY_OUTCOME_INDICES = [0, 1] as const
const PAYOUT_SCALE = 1_000_000n
const CONDITIONAL_TOKENS_PAYOUT_ABI = parseAbi([
  'function payoutDenominator(bytes32) view returns (uint256)',
  'function payoutNumerators(bytes32,uint256) view returns (uint256)',
])

interface OutcomePayoutUpdate {
  index: 0 | 1
  payout: string
}

let conditionalTokensClient: ReturnType<typeof createPublicClient> | null = null
let conditionalTokensClientRpcUrl: string | null = null

function getConditionalTokensClient() {
  const rpcUrl = resolveRuntimeViemRpcUrl()

  if (conditionalTokensClient && conditionalTokensClientRpcUrl === rpcUrl) {
    return conditionalTokensClient
  }

  conditionalTokensClient = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(rpcUrl),
  })
  conditionalTokensClientRpcUrl = rpcUrl

  return conditionalTokensClient
}

function normalizeConditionId(value: string): `0x${string}` | null {
  const normalized = value.trim().toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(normalized) ? normalized as `0x${string}` : null
}

function formatScaledPayout(value: bigint) {
  const whole = value / PAYOUT_SCALE
  const fraction = value % PAYOUT_SCALE
  if (fraction === 0n) {
    return whole.toString()
  }

  return `${whole.toString()}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`
}

function formatPayoutRatio(numerator: bigint, denominator: bigint) {
  const scaled = (numerator * PAYOUT_SCALE + denominator / 2n) / denominator
  return formatScaledPayout(scaled)
}

function buildBinaryPayoutUpdatesFromResolutionPrice(price: number): OutcomePayoutUpdate[] {
  const payoutYes = price >= 1 ? '1' : price <= 0 ? '0' : String(price)
  const payoutNo = price <= 0 ? '1' : price >= 1 ? '0' : String(1 - price)

  return [
    { index: 0, payout: payoutYes },
    { index: 1, payout: payoutNo },
  ]
}

async function readBinaryPayoutsFromConditionalTokens(conditionId: string): Promise<{
  resolutionPrice: string
  updates: OutcomePayoutUpdate[]
} | null> {
  const normalizedConditionId = normalizeConditionId(conditionId)
  if (!normalizedConditionId) {
    return null
  }

  const client = getConditionalTokensClient()
  const denominator = await client.readContract({
    address: CONDITIONAL_TOKENS_CONTRACT,
    abi: CONDITIONAL_TOKENS_PAYOUT_ABI,
    functionName: 'payoutDenominator',
    args: [normalizedConditionId],
  })

  if (denominator <= 0n) {
    return null
  }

  const [yesNumerator, noNumerator] = await Promise.all(
    BINARY_OUTCOME_INDICES.map(index => client.readContract({
      address: CONDITIONAL_TOKENS_CONTRACT,
      abi: CONDITIONAL_TOKENS_PAYOUT_ABI,
      functionName: 'payoutNumerators',
      args: [normalizedConditionId, BigInt(index)],
    })),
  )

  if (yesNumerator === 0n && noNumerator === 0n) {
    return null
  }

  const yesPayout = formatPayoutRatio(yesNumerator, denominator)
  const noPayout = formatPayoutRatio(noNumerator, denominator)

  return {
    resolutionPrice: yesPayout,
    updates: [
      { index: 0, payout: yesPayout },
      { index: 1, payout: noPayout },
    ],
  }
}

export async function updateOutcomePayoutsFromResolutionPrice(
  conditionId: string,
  price: number,
): Promise<boolean> {
  return updateOutcomePayouts(conditionId, buildBinaryPayoutUpdatesFromResolutionPrice(price))
}

async function updateOutcomePayouts(
  conditionId: string,
  updates: OutcomePayoutUpdate[],
): Promise<boolean> {
  let didChange = false
  const payoutValues = updates.map(update => Number(update.payout))
  const maxPayout = Math.max(...payoutValues)
  const hasSingleWinner = maxPayout > 0 && payoutValues.filter(payout => payout === maxPayout).length === 1

  for (const update of updates) {
    const isWinningOutcome = hasSingleWinner && Number(update.payout) === maxPayout
    const changedRows = await db
      .update(outcomesTable)
      .set({
        is_winning_outcome: isWinningOutcome,
        payout_value: update.payout,
      })
      .where(and(
        eq(outcomesTable.condition_id, conditionId),
        eq(outcomesTable.outcome_index, update.index),
        or(
          ne(outcomesTable.is_winning_outcome, isWinningOutcome),
          isNull(outcomesTable.is_winning_outcome),
          isNull(outcomesTable.payout_value),
          ne(outcomesTable.payout_value, update.payout),
        ),
      ))
      .returning({ condition_id: outcomesTable.condition_id })

    if (changedRows.length > 0) {
      didChange = true
    }
  }

  return didChange
}

async function updateConditionResolutionPrice(conditionId: string, resolutionPrice: string) {
  const changedRows = await db
    .update(conditionsTable)
    .set({ resolution_price: resolutionPrice })
    .where(and(
      eq(conditionsTable.id, conditionId),
      or(
        isNull(conditionsTable.resolution_price),
        ne(conditionsTable.resolution_price, resolutionPrice),
      ),
    ))
    .returning({ id: conditionsTable.id })

  return changedRows.length > 0
}

export async function syncMissingOnChainResolvedPayouts(conditionId: string): Promise<boolean> {
  const [conditionRows, outcomeRows] = await Promise.all([
    db
      .select({
        resolution_price: conditionsTable.resolution_price,
      })
      .from(conditionsTable)
      .where(eq(conditionsTable.id, conditionId))
      .limit(1),
    db
      .select({
        outcome_index: outcomesTable.outcome_index,
        payout_value: outcomesTable.payout_value,
      })
      .from(outcomesTable)
      .where(eq(outcomesTable.condition_id, conditionId)),
  ])

  if (outcomeRows.length < 2) {
    return false
  }

  const hasMissingPayoutState = conditionRows[0]?.resolution_price == null
    || outcomeRows.some(outcome => outcome.payout_value == null)

  if (!hasMissingPayoutState) {
    return false
  }

  const chainPayouts = await readBinaryPayoutsFromConditionalTokens(conditionId)
  if (!chainPayouts) {
    return false
  }

  const conditionChanged = await updateConditionResolutionPrice(conditionId, chainPayouts.resolutionPrice)
  const payoutsChanged = await updateOutcomePayouts(conditionId, chainPayouts.updates)

  return conditionChanged || payoutsChanged
}
