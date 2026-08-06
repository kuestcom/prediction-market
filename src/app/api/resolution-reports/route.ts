import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { fetchResolutionRewardAccountProposals, fetchResolutionRewardMarket } from '@/lib/data-api/resolution-rewards'
import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'
import { UserRepository } from '@/lib/db/queries/user'
import { isDirectResolutionConfiguration } from '@/lib/direct-resolution'

const BYTES32_PATTERN = /^0x[\da-f]{64}$/i

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

function parseHistoryCount(value: string | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
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
    const accountProposals = depositWallet ? await fetchResolutionRewardAccountProposals(depositWallet) : []
    const nowSeconds = Math.floor(Date.now() / 1_000)
    const proposals = [rewardMarket.noProposal, rewardMarket.yesProposal].filter(
      (proposal): proposal is NonNullable<typeof proposal> =>
        Boolean(proposal) &&
        proposal?.status !== 'expired' &&
        proposal?.status !== 'released' &&
        proposal?.status !== 'resolved' &&
        !(
          proposal?.status === 'withdrawal_pending' &&
          proposal.withdrawalAvailableAt &&
          Number(proposal.withdrawalAvailableAt) <= nowSeconds
        ),
    )
    // One proposal is allowed per Deposit Wallet for the full market lifetime,
    // including after withdrawal or release.
    const indexedCurrentProposal = accountProposals.find(
      (proposal) => proposal.market.id.toLowerCase() === marketId && proposal.wallet.toLowerCase() === depositWallet,
    )
    const reporters = proposals.map((proposal) => ({
      seed: proposal.wallet.toLowerCase(),
      image: proposal.profile.avatarUrl,
      outcome: proposal.side === 2 ? ('yes' as const) : ('no' as const),
      historyCorrectCount: parseHistoryCount(proposal.history.correct),
      historyIncorrectCount: parseHistoryCount(proposal.history.incorrect),
    }))
    const activeCurrentOutcome = proposals.find((proposal) => proposal.wallet.toLowerCase() === depositWallet)?.side

    return NextResponse.json({
      marketId,
      bond: rewardMarket.bond,
      rewardPool: rewardMarket.rewardPool,
      lockDuration: rewardMarket.lockDuration,
      withdrawalDelay: rewardMarket.withdrawalDelay,
      rewardEnabled: rewardMarket.status === 'active' && BigInt(rewardMarket.bond) > 0n,
      outcomeCounts: {
        yes: proposals.some((proposal) => proposal.side === 2) ? 1 : 0,
        no: proposals.some((proposal) => proposal.side === 1) ? 1 : 0,
        unknown: 0,
      },
      reporters,
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
        currentUser.deposit_wallet_status === 'deployed' &&
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
