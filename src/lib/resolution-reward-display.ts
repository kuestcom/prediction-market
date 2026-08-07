import 'server-only'
import type { DataApiRewardAccount } from '@/lib/data-api/resolution-rewards'

import { fetchResolutionRewardAccount } from '@/lib/data-api/resolution-rewards'
import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'

function awaitWithAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise
  }
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(signal.reason ?? new Error('The resolution reward request was aborted.'))
  }
  const activeSignal = signal

  return new Promise<T>((resolve, reject) => {
    function handleAbort() {
      reject(activeSignal.reason ?? new Error('The resolution reward request was aborted.'))
    }
    activeSignal.addEventListener('abort', handleAbort, { once: true })

    void promise.then(
      (value) => {
        activeSignal.removeEventListener('abort', handleAbort)
        resolve(value)
      },
      (error: unknown) => {
        activeSignal.removeEventListener('abort', handleAbort)
        reject(error)
      },
    )
  })
}

export async function hydrateResolutionRewardAccount(
  account: DataApiRewardAccount | null,
): Promise<DataApiRewardAccount | null> {
  if (!account) {
    return null
  }

  const localMarkets = await ResolutionReportContextRepository.getMarketsByConditionIds(
    account.rewardProposals.flatMap((proposal) => (proposal.market.conditionId ? [proposal.market.conditionId] : [])),
  )
  const localMarketByCondition = new Map(localMarkets.map((market) => [market.conditionId, market]))

  return {
    ...account,
    rewardProposals: account.rewardProposals.map((proposal) => {
      const localMarket = proposal.market.conditionId
        ? localMarketByCondition.get(proposal.market.conditionId.toLowerCase())
        : null

      return {
        ...proposal,
        market: localMarket
          ? { ...proposal.market, ...localMarket }
          : {
              ...proposal.market,
              icon: proposal.market.icon ?? '',
              eventIcon: proposal.market.eventIcon ?? '',
              yesLabel: proposal.market.yesLabel ?? 'YES',
              noLabel: proposal.market.noLabel ?? 'NO',
            },
      }
    }),
  }
}

export async function fetchDisplayResolutionRewardAccount(
  wallet: string,
  options: { signal?: AbortSignal } = {},
): Promise<DataApiRewardAccount | null> {
  const accountWithLocalContext = fetchResolutionRewardAccount(wallet, options).then(hydrateResolutionRewardAccount)
  return awaitWithAbortSignal(accountWithLocalContext, options.signal)
}
