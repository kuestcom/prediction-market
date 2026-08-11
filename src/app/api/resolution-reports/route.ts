import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { fetchResolutionRewardAccount, fetchResolutionRewardMarket } from '@/lib/data-api/resolution-rewards'
import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'
import { UserRepository } from '@/lib/db/queries/user'
import { isDirectResolutionConfiguration } from '@/lib/direct-resolution'
import { parseResolutionHistoryCount } from '@/lib/resolution-reward-history'

const BYTES32_PATTERN = /^0x[\da-f]{64}$/i

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get('conditionId')?.trim().toLowerCase() ?? ''
  const marketId = request.nextUrl.searchParams.get('marketId')?.trim().toLowerCase() ?? ''
  if (!conditionId || conditionId.length > 128 || !BYTES32_PATTERN.test(marketId)) {
    return jsonError('Invalid market.', 'invalid_market', 400)
  }

  try {
    const [currentUser, rewardMarket, marketConfiguration] = await Promise.all([
      UserRepository.getCurrentUser({ minimal: true }),
      fetchResolutionRewardMarket(marketId),
      ResolutionReportContextRepository.getMarketConfiguration(conditionId),
    ])
    if (
      !rewardMarket ||
      rewardMarket.conditionId?.toLowerCase() !== conditionId ||
      !marketConfiguration ||
      !isDirectResolutionConfiguration(marketConfiguration)
    ) {
      return jsonError('Market not found.', 'market_not_found', 404)
    }

    const depositWallet = currentUser?.deposit_wallet_address?.toLowerCase() ?? null
    const rewardAccount = depositWallet ? await fetchResolutionRewardAccount(depositWallet) : null
    const accountProposals = rewardAccount?.rewardProposals ?? []
    const nowSeconds = Math.floor(Date.now() / 1_000)
    const includeResolvedProposals = rewardMarket.status === 'finalized' || Boolean(rewardMarket.resolvedAt)
    function isVisibleProposal<T extends { status: string; withdrawalAvailableAt: string | null }>(
      proposal: T | null | undefined,
    ): proposal is T {
      return Boolean(
        proposal &&
        proposal.status !== 'expired' &&
        proposal.status !== 'released' &&
        (includeResolvedProposals || proposal.status !== 'resolved') &&
        !(
          proposal.status === 'withdrawal_pending' &&
          proposal.withdrawalAvailableAt &&
          Number(proposal.withdrawalAvailableAt) <= nowSeconds
        ),
      )
    }
    const proposals = [rewardMarket.noProposal, rewardMarket.yesProposal].filter(isVisibleProposal)
    // One proposal is allowed per Deposit Wallet for the full market lifetime,
    // including after withdrawal or release.
    const indexedCurrentProposal = accountProposals.find(
      (proposal) => proposal.market.id.toLowerCase() === marketId && proposal.wallet.toLowerCase() === depositWallet,
    )
    // The account and market indexes can settle in different Data API requests. Keep the
    // signed-in reporter visible when the account index already knows about the proposal.
    const visibleProposals = [...proposals]
    if (
      isVisibleProposal(indexedCurrentProposal) &&
      !visibleProposals.some((proposal) => proposal.id === indexedCurrentProposal.id)
    ) {
      visibleProposals.push(indexedCurrentProposal)
    }
    const reporters = visibleProposals.map((proposal) => ({
      seed: proposal.wallet.toLowerCase(),
      wallet: proposal.wallet,
      username: proposal.profile.username,
      image: proposal.profile.avatarUrl,
      outcome: proposal.side === 2 ? ('yes' as const) : ('no' as const),
      rewardAmount: proposal.rewardAmount,
      historyCorrectCount: parseResolutionHistoryCount(proposal.history.correct) ?? 0,
      historyIncorrectCount: parseResolutionHistoryCount(proposal.history.incorrect) ?? 0,
    }))
    const activeCurrentOutcome = visibleProposals.find(
      (proposal) => proposal.wallet.toLowerCase() === depositWallet,
    )?.side
    const currentHistorySource = indexedCurrentProposal ?? accountProposals[0] ?? null
    const currentHistoryCorrect =
      parseResolutionHistoryCount(rewardAccount?.rewardAccountStats?.correct) ??
      parseResolutionHistoryCount(currentHistorySource?.history.correct) ??
      0
    const currentHistoryIncorrect =
      parseResolutionHistoryCount(rewardAccount?.rewardAccountStats?.incorrect) ??
      parseResolutionHistoryCount(currentHistorySource?.history.incorrect) ??
      0

    return NextResponse.json({
      marketId,
      bond: rewardMarket.bond,
      rewardPool: rewardMarket.rewardPool,
      lockDuration: rewardMarket.lockDuration,
      withdrawalDelay: rewardMarket.withdrawalDelay,
      rewardEnabled: rewardMarket.status === 'active' && BigInt(rewardMarket.bond) > 0n,
      outcomeCounts: {
        yes: visibleProposals.some((proposal) => proposal.side === 2) ? 1 : 0,
        no: visibleProposals.some((proposal) => proposal.side === 1) ? 1 : 0,
        unknown: 0,
      },
      reporters,
      currentReporterHistory: {
        correctCount: currentHistoryCorrect,
        incorrectCount: currentHistoryIncorrect,
      },
      currentOutcome:
        indexedCurrentProposal?.side === 2
          ? 'yes'
          : indexedCurrentProposal?.side === 1
            ? 'no'
            : activeCurrentOutcome === 2
              ? 'yes'
              : activeCurrentOutcome === 1
                ? 'no'
                : null,
      eligibility:
        currentUser?.address &&
        currentUser.deposit_wallet_address &&
        rewardMarket.status === 'active' &&
        BigInt(rewardMarket.bond) > 0n
          ? 'eligible'
          : 'ineligible',
    })
  } catch (error) {
    console.error('Could not load on-chain resolution proposal summary:', error)
    return jsonError('Could not load resolution proposals.', 'summary_unavailable', 500)
  }
}
