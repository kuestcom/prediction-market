'use client'

import type { MouseEvent } from 'react'
import type { Address, Hex } from 'viem'
import type { DirectResolutionOutcome } from '@/lib/direct-resolution'
import type { FeeOverrides } from '@/lib/transaction-fees'
import type { Event } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getAddress, isAddress } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
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
import { Label } from '@/components/ui/label'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
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
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { readCreatorProposerWhitelistStatus } from '@/lib/proposer-whitelist'
import { sendWithEstimatedFeeRetry } from '@/lib/transaction-fees'
import { cn } from '@/lib/utils'

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

type DirectResolutionState = 'idle' | 'checking' | 'not_whitelisted' | 'missing_request' | 'pending' | 'submitted' | 'resolved' | 'error'

const WALLET_TRANSACTION_GAS_BUFFER_NUMERATOR = 3n
const WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR = 2n

function addWalletTransactionGasBuffer(gas: bigint) {
  return (
    (gas * WALLET_TRANSACTION_GAS_BUFFER_NUMERATOR)
    + WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR
    - 1n
  ) / WALLET_TRANSACTION_GAS_BUFFER_DENOMINATOR
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
  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)?.outcome_text || fallback
}

function getResolutionSource(market: Event['markets'][number]) {
  return market.resolution_source_url?.trim() || market.resolution_source?.trim() || ''
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
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const rulesCheckboxId = useId()
  const sourceCheckboxId = useId()
  const [open, setOpen] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<DirectResolutionOutcome | null>(null)
  const [rulesConfirmed, setRulesConfirmed] = useState(false)
  const [sourceConfirmed, setSourceConfirmed] = useState(false)
  const [state, setState] = useState<DirectResolutionState>('idle')
  const [message, setMessage] = useState('')

  const isDirect = isDirectResolutionMarket(market)
  const resolutionSource = getResolutionSource(market)
  const requiresSourceConfirmation = Boolean(resolutionSource)
  const connectedAddress = address && isAddress(address) ? getAddress(address) as Address : null
  const isResolved = Boolean(market.is_resolved || market.condition?.resolved)
  const canSubmit = Boolean(
    isDirect
    && connectedAddress
    && selectedOutcome
    && rulesConfirmed
    && (!requiresSourceConfirmation || sourceConfirmed)
    && state !== 'checking'
    && state !== 'pending'
    && state !== 'not_whitelisted'
    && state !== 'missing_request'
    && !isResolved,
  )

  const outcomeOptions = useMemo<Array<{ value: DirectResolutionOutcome, label: string }>>(() => {
    const yesLabel = getOutcomeLabel(market, OUTCOME_INDEX.YES, t('Yes'))
    const noLabel = getOutcomeLabel(market, OUTCOME_INDEX.NO, t('No'))
    const base: Array<{ value: DirectResolutionOutcome, label: string }> = [
      { value: 'yes', label: yesLabel },
      { value: 'no', label: noLabel },
    ]
    return market.neg_risk
      ? base
      : [...base, { value: 'unknown', label: t('Unknown') }]
  }, [market, t])

  function getUserFacingResolutionError(error: unknown) {
    const message = readDirectResolutionError(error)

    if (message === 'Connected proposer wallet needs POL for gas before resolving this market.') {
      return t({
        id: 'directResolutionNeedsPolForGas',
        message: 'Connected proposer wallet needs POL for gas before resolving this market.',
      })
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
      setState('not_whitelisted')
      setMessage(t('Connect an authorized proposer wallet to resolve this market.'))
      return false
    }
    if (!isAddress(event.creator)) {
      setState('error')
      setMessage(t('We could not confirm who controls resolution for this market.'))
      return false
    }

    setState('checking')
    setMessage('')
    try {
      const status = await readCreatorProposerWhitelistStatus({
        creator: getAddress(event.creator) as Address,
      })
      const isAllowed = status.proposers.some(proposer => proposer.toLowerCase() === connectedAddress.toLowerCase())
      if (!status.whitelistAddress || !isAllowed) {
        setState('not_whitelisted')
        setMessage(t('You are not allowed to propose a result for this market.'))
        return false
      }
      setState('idle')
      return true
    }
    catch (error) {
      console.error('Direct resolution whitelist check failed:', error)
      setState('error')
      setMessage(t('We could not check your permission right now. Try again.'))
      return false
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
    if (isResolved) {
      setState('resolved')
      setMessage(t('This market is already resolved.'))
      return
    }
    void checkWhitelist()
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
      const question = normalizeQuestionData(await publicClient.readContract({
        address: adapterAddress,
        abi: CTF_ADAPTER_QUESTION_ABI,
        functionName: 'getQuestion',
        args: [adapterQuestionId],
      }))

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
      const hash = await runWithSignaturePrompt(() => sendWithEstimatedFeeRetry({
        chainId: walletClient.chain?.id ?? DEFAULT_CHAIN_ID,
        client: publicClient,
        send: overrides => writeResolutionTransaction({
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
      }), {
        title: t('Submit final result'),
        description: t('Open your wallet and approve the final result transaction.'),
      })

      setMessage(t('Confirming transaction...'))
      await publicClient.waitForTransactionReceipt({ hash })
      setState('submitted')
      setMessage(t('Result submitted. The market will update shortly.'))
      toast.success(t('Resolution submitted.'))
    }
    catch (error) {
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
    }
    catch (error) {
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Propose resolution')}</DialogTitle>
            <DialogDescription>
              {t('The selected result is final after an approved proposer submits it.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>{t('Final outcome')}</Label>
              <div className="grid gap-2">
                {outcomeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted',
                      selectedOutcome === option.value && 'border-primary bg-primary/10 text-primary',
                    )}
                    onClick={() => setSelectedOutcome(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor={rulesCheckboxId} className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox
                id={rulesCheckboxId}
                checked={rulesConfirmed}
                onCheckedChange={checked => setRulesConfirmed(checked === true)}
              />
              <span>
                {t('I have read the market rules and will resolve according to them.')}
              </span>
            </label>

            {requiresSourceConfirmation && (
              <label htmlFor={sourceCheckboxId} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox
                  id={sourceCheckboxId}
                  checked={sourceConfirmed}
                  onCheckedChange={checked => setSourceConfirmed(checked === true)}
                />
                <span>
                  {t('The final result is published at the listed resolution source and I checked it.')}
                </span>
              </label>
            )}

            {message && (
              <p className={cn(
                'rounded-md border px-3 py-2 text-sm',
                state === 'error' || state === 'not_whitelisted' || state === 'missing_request'
                  ? 'border-destructive/30 bg-destructive/5 text-destructive'
                  : 'text-muted-foreground',
              )}
              >
                {message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={() => void submitResolution()}>
              {state === 'pending'
                ? t('Submitting...')
                : t('Submit final result')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
