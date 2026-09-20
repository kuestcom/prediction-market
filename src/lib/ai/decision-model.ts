import { requestOpenRouterDecisions } from '@/lib/ai/openrouter'

const DECISION_SCORE_CRITERIA = [
  '0 — not relevant or contradictory',
  '1 — weak or indirect match',
  '2 — relevant match with some uncertainty',
  '3 — strong, direct match',
]

interface RankCandidatesWithDecisionModelOptions<T> {
  apiKey: string
  model: string
  candidates: readonly T[]
  state: Record<string, unknown>
  serializeCandidate: (candidate: T, index: number) => Record<string, unknown>
  buildInstructions: (candidate: T, index: number) => string
  timeoutMs?: number
  cacheKey?: string
  cacheTtlMs?: number
  beforeRequest?: () => Promise<boolean>
}

interface DecisionRankingCacheEntry {
  expiresAt: number
  rankedIndexes: number[]
}

const DECISION_RANKING_CACHE_MAX_ENTRIES = 256
const DECISION_RANKING_CACHE_TTL_MS = 60_000
const decisionRankingCache = new Map<string, DecisionRankingCacheEntry>()
const decisionRankingInFlight = new Map<string, Promise<number[] | null>>()

function getCachedDecisionRanking(cacheKey: string) {
  const entry = decisionRankingCache.get(cacheKey)
  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    decisionRankingCache.delete(cacheKey)
    return null
  }

  return entry.rankedIndexes
}

function setCachedDecisionRanking(cacheKey: string, rankedIndexes: number[], ttlMs: number) {
  if (decisionRankingCache.size >= DECISION_RANKING_CACHE_MAX_ENTRIES) {
    const oldestKey = decisionRankingCache.keys().next().value
    if (oldestKey) {
      decisionRankingCache.delete(oldestKey)
    }
  }

  decisionRankingCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    rankedIndexes,
  })
}

function applyDecisionRanking<T>(candidates: readonly T[], rankedIndexes: readonly number[]) {
  if (
    rankedIndexes.length !== candidates.length ||
    new Set(rankedIndexes).size !== candidates.length ||
    rankedIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= candidates.length)
  ) {
    return [...candidates]
  }

  return rankedIndexes.map((index) => candidates[index] as T)
}

async function requestDecisionRanking<T>({
  apiKey,
  model,
  candidates,
  state,
  serializeCandidate,
  buildInstructions,
  timeoutMs,
}: RankCandidatesWithDecisionModelOptions<T>): Promise<number[] | null> {
  const response = await requestOpenRouterDecisions(
    {
      model,
      state: {
        ...state,
        candidates: candidates.map((candidate, index) => ({
          id: String(index),
          ...serializeCandidate(candidate, index),
        })),
      },
      questions: Object.fromEntries(
        candidates.map((candidate, index) => [
          `candidate_${index}`,
          {
            type: 'score' as const,
            instructions: buildInstructions(candidate, index),
            criteria: DECISION_SCORE_CRITERIA,
          },
        ]),
      ),
    },
    { apiKey, timeoutMs },
  )

  const scoredCandidates = candidates.map((_, index) => ({
    index,
    score: response.answers[`candidate_${index}`]?.score,
  }))
  const validScores = scoredCandidates.filter(({ score }) => typeof score === 'number' && Number.isFinite(score))

  if (validScores.length !== candidates.length) {
    return null
  }

  return scoredCandidates
    .sort((left, right) => {
      const leftScore = left.score as number
      const rightScore = right.score as number
      return rightScore - leftScore || left.index - right.index
    })
    .map(({ index }) => index)
}

export async function rankCandidatesWithDecisionModel<T>({
  apiKey,
  model,
  candidates,
  state,
  serializeCandidate,
  buildInstructions,
  timeoutMs = 8_000,
  cacheKey,
  cacheTtlMs = DECISION_RANKING_CACHE_TTL_MS,
  beforeRequest,
}: RankCandidatesWithDecisionModelOptions<T>): Promise<T[]> {
  if (!apiKey || !model || candidates.length < 2) {
    return [...candidates]
  }

  if (!cacheKey) {
    const rankedIndexes = await requestDecisionRanking({
      apiKey,
      model,
      candidates,
      state,
      serializeCandidate,
      buildInstructions,
      timeoutMs,
    })

    return rankedIndexes ? applyDecisionRanking(candidates, rankedIndexes) : [...candidates]
  }

  const cachedRanking = getCachedDecisionRanking(cacheKey)
  if (cachedRanking) {
    return applyDecisionRanking(candidates, cachedRanking)
  }

  let rankingRequest = decisionRankingInFlight.get(cacheKey)
  if (!rankingRequest) {
    rankingRequest = (async () => {
      if (beforeRequest && !(await beforeRequest())) {
        return null
      }

      return requestDecisionRanking({
        apiKey,
        model,
        candidates,
        state,
        serializeCandidate,
        buildInstructions,
        timeoutMs,
      })
    })()
    decisionRankingInFlight.set(cacheKey, rankingRequest)
  }

  try {
    const rankedIndexes = await rankingRequest
    if (rankedIndexes) {
      setCachedDecisionRanking(cacheKey, rankedIndexes, cacheTtlMs)
      return applyDecisionRanking(candidates, rankedIndexes)
    }

    return [...candidates]
  } finally {
    if (decisionRankingInFlight.get(cacheKey) === rankingRequest) {
      decisionRankingInFlight.delete(cacheKey)
    }
  }
}
