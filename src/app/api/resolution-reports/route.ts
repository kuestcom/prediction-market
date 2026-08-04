import type { NextRequest } from 'next/server'
import type { Hex } from 'viem'

import { NextResponse } from 'next/server'
import { createPublicClient, getAddress, isAddress, parseEventLogs } from 'viem'

import { fetchResolutionRewardAccountProposals, fetchResolutionRewardMarket } from '@/lib/data-api/resolution-rewards'
import { ResolutionReportRepository } from '@/lib/db/queries/resolution-report'
import { UserRepository } from '@/lib/db/queries/user'
import { CTF_ADAPTER_QUESTION_ABI, isDirectResolutionConfiguration } from '@/lib/direct-resolution'
import { readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/read-limited-request-body'
import {
  getResolutionRewardMarketId,
  getResolutionRewardsAddress,
  RESOLUTION_REWARDS_ABI,
} from '@/lib/resolution-rewards'
import { createViemTransport, defaultViemNetwork, resolveRuntimeViemRpcUrls } from '@/lib/viem-network'

const MAX_BODY_BYTES = 2_048
const BYTES32_PATTERN = /^0x[\da-f]{64}$/i
const TRANSACTION_HASH_PATTERN = /^0x[\da-f]{64}$/i
const ALLOWED_BODY_KEYS = new Set(['conditionId', 'eventId', 'marketId', 'outcome', 'transactionHash'])

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

function getReporterProfile(
  wallet: string,
  profiles: Array<{ wallet: string | null; image: string | null }>,
  outcome: 'yes' | 'no',
) {
  const profile = profiles.find((candidate) => candidate.wallet?.toLowerCase() === wallet.toLowerCase())
  return {
    seed: wallet.toLowerCase(),
    image: profile?.image ?? '',
    outcome,
  }
}

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get('conditionId')?.trim() ?? ''
  const marketId = request.nextUrl.searchParams.get('marketId')?.trim().toLowerCase() ?? ''
  if (!conditionId || conditionId.length > 128 || !BYTES32_PATTERN.test(marketId)) {
    return jsonError('Invalid market.', 'invalid_market', 400)
  }

  try {
    const target = await ResolutionReportRepository.getTarget(conditionId)
    if (!target || !isDirectResolutionConfiguration(target)) {
      return jsonError('Market not found.', 'market_not_found', 404)
    }

    const [currentUser, rewardMarket] = await Promise.all([
      UserRepository.getCurrentUser({ minimal: true }),
      fetchResolutionRewardMarket(marketId),
    ])
    const depositWallet = currentUser?.deposit_wallet_address?.toLowerCase() ?? null
    const accountProposals = depositWallet ? await fetchResolutionRewardAccountProposals(depositWallet) : []
    const nowSeconds = Math.floor(Date.now() / 1_000)
    const proposals = [rewardMarket?.noProposal, rewardMarket?.yesProposal].filter(
      (proposal): proposal is NonNullable<typeof proposal> =>
        Boolean(proposal) &&
        !(
          proposal?.status === 'withdrawal_pending' &&
          proposal.withdrawalAvailableAt &&
          Number(proposal.withdrawalAvailableAt) <= nowSeconds
        ),
    )
    const profiles = await ResolutionReportRepository.getPublicProfilesByDepositWallet(
      proposals.map((proposal) => proposal.wallet),
    )
    const recordedCurrentOutcome = await ResolutionReportRepository.getCurrentOutcome(marketId, currentUser?.id)
    const indexedCurrentProposal = accountProposals.find(
      (proposal) =>
        proposal.market.id.toLowerCase() === marketId &&
        proposal.wallet.toLowerCase() === depositWallet &&
        proposal.status !== 'none',
    )
    const reporters = proposals.map((proposal) =>
      getReporterProfile(proposal.wallet, profiles, proposal.side === 2 ? 'yes' : 'no'),
    )
    const activeCurrentOutcome = proposals.find((proposal) => proposal.wallet.toLowerCase() === depositWallet)?.side

    return NextResponse.json({
      marketId,
      bond: rewardMarket?.bond ?? '0',
      rewardPool: rewardMarket?.rewardPool ?? '0',
      lockDuration: rewardMarket?.lockDuration ?? '0',
      withdrawalDelay: rewardMarket?.withdrawalDelay ?? '0',
      rewardEnabled: rewardMarket?.status === 'active' && BigInt(rewardMarket.bond) > 0n,
      outcomeCounts: {
        yes: rewardMarket?.yesProposal ? 1 : 0,
        no: rewardMarket?.noProposal ? 1 : 0,
        unknown: 0,
      },
      reporters,
      currentOutcome:
        recordedCurrentOutcome ??
        (indexedCurrentProposal?.side === 2
          ? 'yes'
          : indexedCurrentProposal?.side === 1
            ? 'no'
            : activeCurrentOutcome === 2
              ? 'yes'
              : activeCurrentOutcome === 1
                ? 'no'
                : null),
      eligibility:
        currentUser?.address && currentUser.deposit_wallet_address && rewardMarket?.status === 'active'
          ? 'eligible'
          : 'ineligible',
    })
  } catch (error) {
    console.error('Could not load on-chain resolution proposal summary:', error)
    return jsonError('Could not load resolution proposals.', 'summary_unavailable', 500)
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError('Request is too large.', 'request_too_large', 413)
  }

  const currentUser = await UserRepository.getCurrentUser()
  if (
    !currentUser?.id ||
    !currentUser.address ||
    !isAddress(currentUser.address) ||
    !currentUser.deposit_wallet_address ||
    !isAddress(currentUser.deposit_wallet_address)
  ) {
    return jsonError('A deployed Deposit Wallet is required.', 'deposit_wallet_required', 401)
  }

  let body: Record<string, unknown>
  try {
    const rawBody = await readLimitedRequestBody(request.body, MAX_BODY_BYTES)
    const parsed = JSON.parse(rawBody) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => !ALLOWED_BODY_KEYS.has(key))
    ) {
      return jsonError('Invalid request.', 'invalid_request', 400)
    }
    body = parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError('Request is too large.', 'request_too_large', 413)
    }
    return jsonError('Invalid request.', 'invalid_request', 400)
  }

  const conditionId = typeof body.conditionId === 'string' ? body.conditionId.trim() : ''
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : ''
  const marketId = typeof body.marketId === 'string' ? body.marketId.trim().toLowerCase() : ''
  const transactionHash = typeof body.transactionHash === 'string' ? body.transactionHash.trim().toLowerCase() : ''
  const outcome = body.outcome
  if (
    !conditionId ||
    conditionId.length > 128 ||
    !eventId ||
    eventId.length > 26 ||
    !BYTES32_PATTERN.test(marketId) ||
    !TRANSACTION_HASH_PATTERN.test(transactionHash) ||
    (outcome !== 'yes' && outcome !== 'no')
  ) {
    return jsonError('Invalid request.', 'invalid_request', 400)
  }

  try {
    const target = await ResolutionReportRepository.getTarget(conditionId)
    if (!target || target.eventId !== eventId || !isDirectResolutionConfiguration(target)) {
      return jsonError('Market not found.', 'market_not_found', 404)
    }
    if (!target.marketActive || target.eventStatus !== 'active' || target.marketResolved || target.conditionResolved) {
      return jsonError('This market is already resolved.', 'market_resolved', 409)
    }
    if (!isAddress(target.oracle) || !BYTES32_PATTERN.test(target.adapterQuestionId)) {
      return jsonError('Market reward request is unavailable.', 'reward_request_unavailable', 409)
    }

    const client = createPublicClient({
      chain: defaultViemNetwork,
      transport: createViemTransport(resolveRuntimeViemRpcUrls()),
    })
    const [question, receipt] = await Promise.all([
      client.readContract({
        address: getAddress(target.oracle),
        abi: CTF_ADAPTER_QUESTION_ABI,
        functionName: 'getQuestion',
        args: [target.adapterQuestionId as Hex],
      }),
      client.getTransactionReceipt({ hash: transactionHash as Hex }),
    ])
    const ancillaryData = Array.isArray(question) ? question[11] : question.ancillaryData
    const expectedMarketId = getResolutionRewardMarketId(getAddress(target.oracle), ancillaryData as Hex)
    if (expectedMarketId.toLowerCase() !== marketId) {
      return jsonError('Reward market does not match this market.', 'market_mismatch', 409)
    }
    if (receipt.status !== 'success') {
      return jsonError('Proposal transaction failed.', 'transaction_failed', 409)
    }

    const proposalEvents = parseEventLogs({
      abi: RESOLUTION_REWARDS_ABI,
      eventName: 'ProposalSubmitted',
      logs: receipt.logs.filter((log) => log.address.toLowerCase() === getResolutionRewardsAddress().toLowerCase()),
      strict: true,
    })
    const depositWallet = getAddress(currentUser.deposit_wallet_address)
    const expectedSide = outcome === 'yes' ? 2 : 1
    const proposalEvent = proposalEvents.find(
      (event) =>
        event.args.marketId.toLowerCase() === marketId &&
        event.args.wallet.toLowerCase() === depositWallet.toLowerCase() &&
        event.args.side === expectedSide,
    )
    if (!proposalEvent) {
      return jsonError('Proposal event was not found in this transaction.', 'proposal_event_not_found', 409)
    }

    const report = await ResolutionReportRepository.recordVerifiedProposal({
      conditionId,
      eventId,
      userId: currentUser.id,
      reporterAddress: depositWallet,
      managedRequestId: expectedMarketId,
      proposalId: proposalEvent.args.proposalId.toString(),
      transactionHash,
      outcome,
    })

    return NextResponse.json({
      id: report?.id,
      proposalId: proposalEvent.args.proposalId.toString(),
      outcome,
    })
  } catch (error) {
    console.error('Could not verify and record resolution proposal:', error)
    return jsonError('Could not verify resolution proposal.', 'verification_failed', 500)
  }
}
