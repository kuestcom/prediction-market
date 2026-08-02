'use client'

import type { MouseEvent } from 'react'
import type { Address, Hex } from 'viem'

import { useAppKitAccount } from '@reown/appkit/react'
import { BookOpenCheckIcon, ChevronDownIcon, ExternalLinkIcon, LinkIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useId, useMemo, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { usePublicClient, useSignMessage, useWalletClient } from 'wagmi'

import type { DirectResolutionOutcome } from '@/lib/direct-resolution'
import type { FeeOverrides } from '@/lib/transaction-fees'
import type { Event } from '@/types'

import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { OUTCOME_INDEX } from '@/lib/constants'
import {
  CTF_ADAPTER_QUESTION_ABI,
  DIRECT_RESOLUTION_ORACLE_ABI,
  getDirectResolutionAdapterAddress,
  getDirectResolutionNegRiskOperatorAddress,
  getDirectResolutionOracleAddress,
  getDirectResolutionPrice,
  getDirectResolutionQuestionIds,
  isDirectResolutionMarket,
  readDirectResolutionError,
  YES_OR_NO_IDENTIFIER,
} from '@/lib/direct-resolution'
import { formatCentsLabel } from '@/lib/formatters'
import { resolveFallbackOutcomeUnitPrice } from '@/lib/market-pricing'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { readCreatorProposerWhitelistStatus } from '@/lib/proposer-whitelist'
import { buildResolutionReportMessage } from '@/lib/resolution-report'
import { sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'
import { cn } from '@/lib/utils'
import { resolveViemRpcUrls } from '@/lib/viem-network'

interface DirectResolutionButtonProps {
  market: Event['markets'][number]
  event: Event
  size?: 'sm' | 'default'
  className?: string
  disabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}

interface AdapterQuestionData {
  requestTimestamp: bigint
  resolved: boolean
  ancillaryData: Hex
}

type DirectResolutionState =
  | 'idle'
  | 'checking'
  | 'permission_check_error'
  | 'not_whitelisted'
  | 'missing_request'
  | 'pending'
  | 'submitted'
  | 'resolved'
  | 'error'

type ResolutionReportEligibility = 'signed_out' | 'eligible' | 'ineligible' | 'unavailable'

interface ResolutionReportSummary {
  outcomeCounts: Record<DirectResolutionOutcome, number>
  reporters: Array<{
    seed: string
    image: string
    outcome: DirectResolutionOutcome
  }>
  currentOutcome: DirectResolutionOutcome | null
  eligibility: ResolutionReportEligibility
}

const WALLET_TRANSACTION_GAS_BUFFER_NUMERATOR = 3n
const WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR = 2n

function addWalletTransactionGasBuffer(gas: bigint) {
  return (
    (gas * WALLET_TRANSACTION_GAS_BUFFER_NUMERATOR + WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR - 1n) /
    WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR
  )
}

function normalizeQuestionData(value: unknown): AdapterQuestionData | null {
  if (Array.isArray(value)) {
    const requestTimestamp = value[0]
    const resolved = value[5]
    const ancillaryData = value[11]
    if (typeof requestTimestamp !== 'bigint' || typeof resolved !== 'boolean' || typeof ancillaryData !== 'string') {
      return null
    }
    return {
      requestTimestamp,
      resolved,
      ancillaryData: ancillaryData as Hex,
    }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const requestTimestamp = record.requestTimestamp
  const resolved = record.resolved
  const ancillaryData = record.ancillaryData

  if (typeof requestTimestamp !== 'bigint' || typeof resolved !== 'boolean' || typeof ancillaryData !== 'string') {
    return null
  }

  return {
    requestTimestamp,
    resolved,
    ancillaryData: ancillaryData as Hex,
  }
}

function getOutcomeLabel(market: Event['markets'][number], outcomeIndex: number, fallback: string) {
  return market.outcomes.find((outcome) => outcome.outcome_index === outcomeIndex)?.outcome_text || fallback
}

function getResolutionSource(market: Event['markets'][number]) {
  return market.resolution_source_url?.trim() || market.resolution_source?.trim() || ''
}

function getResolutionSourceUrl(market: Event['markets'][number]) {
  const value = market.resolution_source_url?.trim()
  if (!value) {
    return null
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function normalizeLabel(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim() ?? ''
  )
}

function normalizeAccentColor(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return /^#[\da-f]{6}$/i.test(normalized) ? normalized : null
}

function ResolutionReporterStack({
  reporters,
  totalCount,
}: {
  reporters: ResolutionReportSummary['reporters']
  totalCount: number
}) {
  if (totalCount <= 0) {
    return null
  }

  const overflowCount = Math.max(0, totalCount - reporters.length)

  return (
    <div className="mt-3 flex items-center justify-center" aria-hidden>
      <div className="flex -space-x-2">
        {reporters.map((reporter) => {
          const showPlaceholder = shouldUseAvatarPlaceholder(reporter.image)
          return showPlaceholder ? (
            <span
              key={reporter.seed}
              className="size-7 rounded-full border-2 border-background"
              style={getAvatarPlaceholderStyle(reporter.seed)}
              aria-hidden
            />
          ) : (
            <Image
              key={reporter.seed}
              src={reporter.image}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full border-2 border-background object-cover"
            />
          )
        })}
        {overflowCount > 0 && (
          <span className="grid size-7 place-items-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
            +{overflowCount}
          </span>
        )}
      </div>
    </div>
  )
}

export default function DirectResolutionButton({
  market,
  event,
  size = 'sm',
  className,
  disabled = false,
  onClick,
}: DirectResolutionButtonProps) {
  const t = useExtracted()
  const { address } = useAppKitAccount({ namespace: 'eip155' })
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { signMessageAsync } = useSignMessage()
  const { polygonRpcUrl } = usePublicRuntimeConfig()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const isMobile = useIsMobile()
  const viemRpcUrls = useMemo(() => resolveViemRpcUrls(polygonRpcUrl), [polygonRpcUrl])
  const unknownCheckboxId = useId()
  const rulesCheckboxId = useId()
  const sourceCheckboxId = useId()
  const [open, setOpen] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<DirectResolutionOutcome | null>(null)
  const [rulesConfirmed, setRulesConfirmed] = useState(false)
  const [sourceConfirmed, setSourceConfirmed] = useState(false)
  const [state, setState] = useState<DirectResolutionState>('idle')
  const [message, setMessage] = useState('')
  const [resolutionAccess, setResolutionAccess] = useState<boolean | null>(null)
  const [reportSummaryLoading, setReportSummaryLoading] = useState(false)
  const [reportSummary, setReportSummary] = useState<ResolutionReportSummary>({
    outcomeCounts: { yes: 0, no: 0, unknown: 0 },
    reporters: [],
    currentOutcome: null,
    eligibility: 'unavailable',
  })

  const isDirect = isDirectResolutionMarket(market)
  const resolutionSource = getResolutionSource(market)
  const resolutionSourceUrl = getResolutionSourceUrl(market)
  const resolutionRules = market.market_rules?.trim() || event.rules?.trim() || ''
  const resolutionQuestion = market.question?.trim() || market.title
  const normalizedResolutionQuestion = normalizeLabel(resolutionQuestion)
  const shouldShowResolutionQuestion =
    Boolean(normalizedResolutionQuestion) &&
    normalizedResolutionQuestion !== normalizeLabel(event.title) &&
    normalizedResolutionQuestion !== normalizeLabel(market.title)
  const requiresSourceConfirmation = Boolean(resolutionSource)
  const connectedAddress = address && isAddress(address) ? (getAddress(address) as Address) : null
  const isResolved = Boolean(market.is_resolved || market.condition?.resolved)
  const isProposalOnly = resolutionAccess === false
  const canSubmit = Boolean(
    isDirect &&
    connectedAddress &&
    selectedOutcome &&
    rulesConfirmed &&
    (!requiresSourceConfirmation || sourceConfirmed) &&
    state !== 'checking' &&
    state !== 'pending' &&
    state !== 'missing_request' &&
    resolutionAccess !== null &&
    (resolutionAccess || reportSummary.eligibility === 'eligible') &&
    !isResolved,
  )

  const outcomeOptions = useMemo(() => {
    const yesLabel = getOutcomeLabel(market, OUTCOME_INDEX.YES, t('Yes'))
    const noLabel = getOutcomeLabel(market, OUTCOME_INDEX.NO, t('No'))
    const teams = event.sports_teams ?? []
    const logoUrls = event.sports_team_logo_urls ?? []

    function resolveImageUrl(label: string) {
      const normalizedOutcomeLabel = normalizeLabel(label)
      const teamIndex = teams.findIndex((team) => {
        const normalizedName = normalizeLabel(team.name)
        const normalizedAbbreviation = normalizeLabel(team.abbreviation)
        return (
          Boolean(normalizedOutcomeLabel) &&
          (normalizedOutcomeLabel === normalizedName ||
            normalizedOutcomeLabel === normalizedAbbreviation ||
            (Boolean(normalizedName) && normalizedOutcomeLabel.includes(normalizedName)))
        )
      })
      if (teamIndex >= 0) {
        return teams[teamIndex]?.logo_url?.trim() || logoUrls[teamIndex]?.trim() || null
      }

      return null
    }

    function resolveTeamColor(label: string) {
      const normalizedOutcomeLabel = normalizeLabel(label)
      const team = teams.find((candidate) => {
        const normalizedName = normalizeLabel(candidate.name)
        const normalizedAbbreviation = normalizeLabel(candidate.abbreviation)
        return normalizedOutcomeLabel === normalizedName || normalizedOutcomeLabel === normalizedAbbreviation
      })
      return normalizeAccentColor(team?.color)
    }

    const base = [
      {
        value: 'yes' as const,
        label: yesLabel,
        outcomeIndex: OUTCOME_INDEX.YES,
        price: resolveFallbackOutcomeUnitPrice(market, OUTCOME_INDEX.YES),
        imageUrl: resolveImageUrl(yesLabel),
        accentColor: resolveTeamColor(yesLabel),
      },
      {
        value: 'no' as const,
        label: noLabel,
        outcomeIndex: OUTCOME_INDEX.NO,
        price: resolveFallbackOutcomeUnitPrice(market, OUTCOME_INDEX.NO),
        imageUrl: resolveImageUrl(noLabel),
        accentColor: resolveTeamColor(noLabel),
      },
    ]
    return base
  }, [event.sports_team_logo_urls, event.sports_teams, market, t])
  const showOutcomeImages = outcomeOptions.every((option) => Boolean(option.imageUrl))

  function getUserFacingResolutionError(error: unknown) {
    const message = readDirectResolutionError(error)

    if (message === 'Connected proposer wallet needs POL for gas before resolving this market.') {
      return t('Connected proposer wallet needs POL for gas before resolving this market.')
    }
    if (message === 'Transaction could not be sent because the gas fee is below the current network minimum.') {
      return t('Transaction could not be sent because the gas fee is below the current network minimum.')
    }
    if (message === 'Wallet signature was rejected.') {
      return t('Wallet signature was rejected.')
    }
    if (message === 'You are not allowed to propose a result for this market.') {
      return t('You are not allowed to propose a result for this market.')
    }
    if (message === 'This market is already resolved.') {
      return t('This market is already resolved.')
    }
    return t('Could not submit resolution.')
  }

  async function checkWhitelist() {
    if (!connectedAddress) {
      setResolutionAccess(false)
      setState('not_whitelisted')
      setMessage('')
      return false
    }
    if (!isAddress(event.creator)) {
      setResolutionAccess(false)
      setState('not_whitelisted')
      setMessage('')
      return false
    }

    setResolutionAccess(null)
    setState('checking')
    setMessage('')
    try {
      const status = await readCreatorProposerWhitelistStatus({
        creator: getAddress(event.creator) as Address,
        rpcUrls: viemRpcUrls,
      })
      const isAllowed = status.proposers.some((proposer) => proposer.toLowerCase() === connectedAddress.toLowerCase())
      if (!status.whitelistAddress || !isAllowed) {
        setResolutionAccess(false)
        setState('not_whitelisted')
        setMessage('')
        return false
      }
      setResolutionAccess(true)
      setState('idle')
      return true
    } catch (error) {
      console.error('Direct resolution whitelist check failed:', error)
      setResolutionAccess(null)
      setState('permission_check_error')
      setMessage(t('Could not check your resolution permission. Try again.'))
      return null
    }
  }

  async function checkResolutionAccess() {
    const allowed = await checkWhitelist()
    await loadReportSummary({ includeEligibility: allowed === false })
    return allowed
  }

  async function loadReportSummary({ includeEligibility = false, preserveEligibilityOnError = false } = {}) {
    setReportSummaryLoading(true)
    try {
      const searchParams = new URLSearchParams({ conditionId: market.condition_id })
      if (includeEligibility) {
        searchParams.set('includeEligibility', 'true')
      }
      const response = await fetch(`/api/resolution-reports?${searchParams.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Resolution report summary failed with ${response.status}.`)
      }
      const summary = (await response.json()) as ResolutionReportSummary
      setReportSummary(summary)
      if (summary.currentOutcome) {
        setSelectedOutcome((current) => current ?? summary.currentOutcome)
      }
    } catch (error) {
      console.error('Could not load resolution report summary:', error)
      if (!preserveEligibilityOnError) {
        setReportSummary((current) => ({ ...current, eligibility: 'unavailable' }))
      }
    } finally {
      setReportSummaryLoading(false)
    }
  }

  async function openDialog(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (event.defaultPrevented) {
      return
    }
    setOpen(true)
    setSelectedOutcome(null)
    setRulesConfirmed(false)
    setSourceConfirmed(false)
    setResolutionAccess(null)
    setMessage('')
    if (isResolved) {
      setState('resolved')
      setMessage(t('This market is already resolved.'))
      return
    }
    void checkResolutionAccess()
  }

  async function submitResolutionReport() {
    if (!connectedAddress || !selectedOutcome) {
      toast.error(t('Wallet connection is not ready.'))
      return
    }

    setState('pending')
    setMessage('')
    try {
      const issuedAt = new Date().toISOString()
      const nonce = crypto.randomUUID()
      const messageToSign = buildResolutionReportMessage({
        conditionId: market.condition_id,
        eventId: event.id,
        issuedAt,
        nonce,
        outcome: selectedOutcome,
        reporterAddress: connectedAddress,
      })
      const signature = await runWithSignaturePrompt(() => signMessageAsync({ message: messageToSign }), {
        title: t('Propose resolution'),
        description: t('Sign this resolution proposal with your wallet.'),
      })
      const response = await fetch('/api/resolution-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionId: market.condition_id,
          eventId: event.id,
          issuedAt,
          nonce,
          outcome: selectedOutcome,
          reporterAddress: connectedAddress,
          signature,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { code?: string } | null
      if (!response.ok) {
        if (payload?.code === 'not_eligible') {
          setReportSummary((current) => ({ ...current, eligibility: 'ineligible' }))
          throw new Error('not_eligible')
        }
        if (payload?.code === 'eligibility_unavailable') {
          setReportSummary((current) => ({ ...current, eligibility: 'unavailable' }))
          throw new Error('eligibility_unavailable')
        }
        throw new Error(payload?.code || 'submission_failed')
      }

      setState('submitted')
      setMessage(t('Resolution proposal submitted.'))
      toast.success(t('Resolution proposal submitted.'))
      await loadReportSummary({ includeEligibility: true, preserveEligibilityOnError: true })
    } catch (error) {
      console.error('Could not submit resolution report:', error)
      setState('error')
      const knownEligibilityError =
        error instanceof Error && (error.message === 'not_eligible' || error.message === 'eligibility_unavailable')
      setMessage(knownEligibilityError ? '' : t('Could not submit resolution proposal.'))
    }
  }

  async function submitResolution() {
    if (!publicClient || !walletClient || !connectedAddress || !selectedOutcome) {
      toast.error(t('Wallet connection is not ready.'))
      return
    }

    const allowed = await checkWhitelist()
    if (!allowed) {
      return
    }

    const adapterAddress = getDirectResolutionAdapterAddress(market)
    const { adapterQuestionId, negRiskOperatorQuestionId } = getDirectResolutionQuestionIds(market)
    if (!adapterAddress || !adapterQuestionId || (market.neg_risk && !negRiskOperatorQuestionId)) {
      setState('missing_request')
      setMessage(t('This market is not ready for direct resolution yet.'))
      return
    }

    setState('pending')
    setMessage('')
    try {
      const question = normalizeQuestionData(
        await publicClient.readContract({
          address: adapterAddress,
          abi: CTF_ADAPTER_QUESTION_ABI,
          functionName: 'getQuestion',
          args: [adapterQuestionId],
        }),
      )

      if (!question || question.requestTimestamp === 0n || question.ancillaryData === '0x') {
        setState('missing_request')
        setMessage(t('This market is not ready for direct resolution yet.'))
        return
      }

      if (question.resolved) {
        setState('resolved')
        setMessage(t('This market is already resolved.'))
        return
      }

      const proposedPrice = getDirectResolutionPrice(selectedOutcome)
      const gas = await estimateResolutionGas({
        adapterAddress,
        adapterQuestionId,
        ancillaryData: question.ancillaryData,
        connectedAddress,
        negRiskOperatorQuestionId,
        proposedPrice,
        requestTimestamp: question.requestTimestamp,
      })
      const hash = await runWithSignaturePrompt(
        () =>
          sendWithEstimatedFeeRetry({
            chainId: walletClient.chain?.id ?? DEFAULT_CHAIN_ID,
            client: publicClient,
            send: (overrides) =>
              writeResolutionTransaction({
                adapterAddress,
                adapterQuestionId,
                ancillaryData: question.ancillaryData,
                connectedAddress,
                gas,
                negRiskOperatorQuestionId,
                overrides,
                proposedPrice,
                requestTimestamp: question.requestTimestamp,
              }),
          }),
        {
          title: t('Submit final result'),
          description: t('Open your wallet and approve the final result transaction.'),
        },
      )

      setMessage(t('Confirming transaction...'))
      await publicClient.waitForTransactionReceipt({ hash })
      setState('submitted')
      setMessage(t('Result submitted. The market will update shortly.'))
      toast.success(t('Resolution submitted.'))
    } catch (error) {
      console.error('Direct resolution failed:', error)
      setState('error')
      setMessage(getUserFacingResolutionError(error))
    }
  }

  async function estimateResolutionGas(input: {
    adapterAddress: Address
    adapterQuestionId: Hex
    ancillaryData: Hex
    connectedAddress: Address
    negRiskOperatorQuestionId: Hex | null
    proposedPrice: bigint
    requestTimestamp: bigint
  }) {
    try {
      const estimatedGas = market.neg_risk
        ? await publicClient?.estimateContractGas({
            account: input.connectedAddress,
            address: getDirectResolutionOracleAddress(),
            abi: DIRECT_RESOLUTION_ORACLE_ABI,
            functionName: 'proposeAndResolveNegRisk',
            args: [
              input.adapterAddress,
              getDirectResolutionNegRiskOperatorAddress(),
              input.adapterQuestionId,
              input.negRiskOperatorQuestionId as Hex,
              YES_OR_NO_IDENTIFIER,
              input.requestTimestamp,
              input.ancillaryData,
              input.proposedPrice,
            ],
          })
        : await publicClient?.estimateContractGas({
            account: input.connectedAddress,
            address: getDirectResolutionOracleAddress(),
            abi: DIRECT_RESOLUTION_ORACLE_ABI,
            functionName: 'proposeAndResolve',
            args: [
              input.adapterAddress,
              input.adapterQuestionId,
              YES_OR_NO_IDENTIFIER,
              input.requestTimestamp,
              input.ancillaryData,
              input.proposedPrice,
            ],
          })

      return estimatedGas ? addWalletTransactionGasBuffer(estimatedGas) : undefined
    } catch (error) {
      console.warn('Could not estimate direct resolution gas:', error)
      return undefined
    }
  }

  function writeResolutionTransaction(input: {
    adapterAddress: Address
    adapterQuestionId: Hex
    ancillaryData: Hex
    connectedAddress: Address
    gas: bigint | undefined
    negRiskOperatorQuestionId: Hex | null
    overrides?: FeeOverrides
    proposedPrice: bigint
    requestTimestamp: bigint
  }) {
    return market.neg_risk
      ? walletClient!.writeContract({
          account: input.connectedAddress,
          address: getDirectResolutionOracleAddress(),
          abi: DIRECT_RESOLUTION_ORACLE_ABI,
          functionName: 'proposeAndResolveNegRisk',
          args: [
            input.adapterAddress,
            getDirectResolutionNegRiskOperatorAddress(),
            input.adapterQuestionId,
            input.negRiskOperatorQuestionId as Hex,
            YES_OR_NO_IDENTIFIER,
            input.requestTimestamp,
            input.ancillaryData,
            input.proposedPrice,
          ],
          gas: input.gas,
          ...(input.overrides ?? {}),
        })
      : walletClient!.writeContract({
          account: input.connectedAddress,
          address: getDirectResolutionOracleAddress(),
          abi: DIRECT_RESOLUTION_ORACLE_ABI,
          functionName: 'proposeAndResolve',
          args: [
            input.adapterAddress,
            input.adapterQuestionId,
            YES_OR_NO_IDENTIFIER,
            input.requestTimestamp,
            input.ancillaryData,
            input.proposedPrice,
          ],
          gas: input.gas,
          ...(input.overrides ?? {}),
        })
  }

  if (!isDirect) {
    return null
  }

  const eventSummary = (
    <div className="flex min-w-0 items-center gap-3 px-1 text-left">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border bg-background">
        {event.icon_url ? (
          <EventIconImage src={event.icon_url} alt={event.title} sizes="40px" containerClassName="size-full" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">
            {event.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold text-foreground">{event.title}</p>
      </div>
    </div>
  )

  const outcomePicker = (
    <section className="rounded-xl border bg-muted/10 p-3 sm:p-4">
      {shouldShowResolutionQuestion && (
        <Label className="mb-3 block text-sm leading-snug font-semibold">{resolutionQuestion}</Label>
      )}

      <div className="grid grid-cols-2 gap-2">
        {outcomeOptions.map((option) => {
          const selected = selectedOutcome === option.value
          const accentColor = option.accentColor || (option.value === 'yes' ? 'var(--yes)' : 'var(--no)')

          const optionReporters = reportSummary.reporters.filter((reporter) => reporter.outcome === option.value)

          return (
            <div key={option.value} className="flex min-w-0 flex-col">
              <button
                type="button"
                className={cn(
                  `group flex w-full min-w-0 rounded-lg bg-background p-3 transition-[background-color,color,transform,filter] active:translate-y-px`,
                  showOutcomeImages
                    ? 'min-h-28 flex-col items-stretch gap-3 text-left'
                    : 'min-h-14 items-center justify-center gap-2 text-center',
                  selected ? 'border border-transparent text-white hover:brightness-95' : 'border hover:bg-muted/30',
                )}
                style={{
                  backgroundColor: selected ? accentColor : undefined,
                }}
                onClick={() => setSelectedOutcome(option.value)}
                aria-pressed={selected}
              >
                {showOutcomeImages ? (
                  <>
                    <span className="flex min-h-10 items-center justify-between gap-3">
                      <EventIconImage
                        src={option.imageUrl!}
                        alt={option.label}
                        sizes="40px"
                        containerClassName="size-10 shrink-0 rounded-md bg-muted"
                        imageClassName="object-contain"
                      />
                      <span className="shrink-0 text-lg font-bold tabular-nums">
                        {formatCentsLabel(option.price, { fallback: '—' })}
                      </span>
                    </span>
                    <span
                      className={cn('text-sm leading-snug font-semibold break-words', !selected && 'text-foreground')}
                    >
                      {option.label}
                    </span>
                  </>
                ) : (
                  <span className="flex max-w-full min-w-0 items-baseline justify-center gap-2">
                    <span
                      className={cn(
                        'min-w-0 truncate text-sm leading-snug font-semibold',
                        !selected && 'text-foreground',
                      )}
                      title={option.label}
                    >
                      {option.label}
                    </span>
                    <span className="shrink-0 text-base font-bold tabular-nums">
                      {formatCentsLabel(option.price, { fallback: '—' })}
                    </span>
                  </span>
                )}
              </button>
              <ResolutionReporterStack
                reporters={optionReporters}
                totalCount={reportSummary.outcomeCounts[option.value]}
              />
            </div>
          )
        })}
      </div>

      {!market.neg_risk && (
        <div>
          <details
            className={cn(
              'group mt-3 overflow-hidden rounded-lg border bg-background',
              selectedOutcome === 'unknown' && 'border-primary/50 bg-primary/5',
            )}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3 text-sm font-medium marker:hidden">
              <span className="flex-1">{t('Inconclusive result')}</span>
              <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t px-3 py-3">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {t(
                    'Choose Inconclusive result only when the market cannot be resolved to either listed outcome. It splits the payout equally between both outcomes.',
                  )}
                </span>
              </p>
              <label htmlFor={unknownCheckboxId} className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  id={unknownCheckboxId}
                  checked={selectedOutcome === 'unknown'}
                  onCheckedChange={(checked) => setSelectedOutcome(checked === true ? 'unknown' : null)}
                />
                <span>{t('Inconclusive result')}</span>
              </label>
            </div>
          </details>
          <ResolutionReporterStack
            reporters={reportSummary.reporters.filter((reporter) => reporter.outcome === 'unknown')}
            totalCount={reportSummary.outcomeCounts.unknown}
          />
        </div>
      )}
    </section>
  )

  const rulesConfirmation = (
    <label
      htmlFor={rulesCheckboxId}
      className={cn(
        'flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/20',
        resolutionRules && 'border-t',
        rulesConfirmed && 'bg-primary/5',
      )}
    >
      <Checkbox
        id={rulesCheckboxId}
        checked={rulesConfirmed}
        onCheckedChange={(checked) => setRulesConfirmed(checked === true)}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1 leading-relaxed">
        {t('I have read the market rules and will resolve according to them.')}
      </span>
    </label>
  )

  const rulesDisclosure = resolutionRules ? (
    <details className="group rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 text-sm font-medium marker:hidden">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground',
            rulesConfirmed && 'bg-primary/10 text-primary',
          )}
        >
          <BookOpenCheckIcon className="size-4" aria-hidden />
        </span>
        <span className="flex-1">{t('Rules')}</span>
        <ChevronDownIcon
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="max-h-48 overflow-y-auto border-t px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
        {resolutionRules}
      </div>
      {rulesConfirmation}
    </details>
  ) : (
    <div className="overflow-hidden rounded-lg border bg-background">{rulesConfirmation}</div>
  )

  const sourceConfirmation = requiresSourceConfirmation ? (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/20',
        sourceConfirmed && 'border-primary/40 bg-primary/5',
      )}
    >
      <Checkbox
        id={sourceCheckboxId}
        checked={sourceConfirmed}
        onCheckedChange={(checked) => setSourceConfirmed(checked === true)}
        className="mt-1 shrink-0"
      />
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground',
          sourceConfirmed && 'bg-primary/10 text-primary',
        )}
      >
        <LinkIcon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <label htmlFor={sourceCheckboxId} className="cursor-pointer leading-relaxed">
          {t('The final result is published at the listed resolution source and I checked it.')}
        </label>{' '}
        {resolutionSourceUrl ? (
          <a
            href={resolutionSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex max-w-full items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            title={resolutionSource}
          >
            <span className="truncate">{resolutionSource}</span>
            <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground" title={resolutionSource}>
            {resolutionSource}
          </span>
        )}
      </span>
    </div>
  ) : null

  const modalBody = (
    <div className="grid gap-3 py-1">
      {eventSummary}
      {outcomePicker}
      {rulesDisclosure}
      {sourceConfirmation}

      {isProposalOnly && !reportSummaryLoading && reportSummary.eligibility !== 'eligible' && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t('You are not authorized to propose a resolution for this market.')}
        </p>
      )}

      {message && (
        <p
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            state === 'error' || state === 'missing_request'
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )

  const modalFooter = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        {t('Cancel')}
      </Button>
      {state === 'permission_check_error' ? (
        <Button type="button" onClick={() => void checkResolutionAccess()} className="sm:min-w-40">
          {t('Retry permission check')}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => void (isProposalOnly ? submitResolutionReport() : submitResolution())}
          className="sm:min-w-40"
        >
          {state === 'pending' ? t('Submitting...') : t('Propose resolution')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn('shrink-0', className)}
        disabled={disabled || isResolved}
        onClick={openDialog}
      >
        {t('Propose resolution')}
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[92dvh] w-full overflow-x-hidden bg-background px-4 pt-2 pb-6">
            <DrawerHeader className="mt-0 min-w-0 gap-2 px-0 pt-2 pb-3 text-left">
              <DrawerTitle>{t('Propose resolution')}</DrawerTitle>
              <DrawerDescription>
                {t('The selected result is final after an approved proposer submits it.')}
              </DrawerDescription>
            </DrawerHeader>
            {modalBody}
            <DrawerFooter className="mt-4 border-t border-border/50 px-0 pt-4 pb-0">{modalFooter}</DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92dvh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-xl">
            <DialogHeader className="min-w-0">
              <DialogTitle>{t('Propose resolution')}</DialogTitle>
              <DialogDescription>
                {t('The selected result is final after an approved proposer submits it.')}
              </DialogDescription>
            </DialogHeader>
            {modalBody}
            <DialogFooter className="border-t border-border/50 pt-4">{modalFooter}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
