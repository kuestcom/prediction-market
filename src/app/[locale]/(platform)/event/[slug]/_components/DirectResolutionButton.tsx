'use client'

import type { MouseEvent } from 'react'
import type { Address, Hex } from 'viem'
import type { DirectResolutionOutcome } from '@/lib/direct-resolution'
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
  YES_OR_NO_IDENTIFIER,
} from '@/lib/direct-resolution'
import { readCreatorProposerWhitelistStatus } from '@/lib/proposer-whitelist'
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

  async function checkWhitelist() {
    if (!connectedAddress) {
      setState('not_whitelisted')
      setMessage(t('Connect an authorized proposer wallet to resolve this market.'))
      return false
    }
    if (!isAddress(event.creator)) {
      setState('error')
      setMessage(t('Creator wallet is unavailable for whitelist validation.'))
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
        setMessage(t('Connected wallet is not on the creator proposer whitelist.'))
        return false
      }
      setState('idle')
      return true
    }
    catch (error) {
      console.error('Direct resolution whitelist check failed:', error)
      setState('error')
      setMessage(t('Could not validate proposer whitelist.'))
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
      setMessage(t('Direct resolution request was not found for this market.'))
      return
    }

    setState('pending')
    setMessage(t('Transaction pending.'))
    try {
      const question = normalizeQuestionData(await publicClient.readContract({
        address: adapterAddress,
        abi: CTF_ADAPTER_QUESTION_ABI,
        functionName: 'getQuestion',
        args: [adapterQuestionId],
      }))

      if (!question || question.requestTimestamp === 0n || question.ancillaryData === '0x') {
        setState('missing_request')
        setMessage(t('Direct resolution request was not found for this market.'))
        return
      }

      if (question.resolved) {
        setState('resolved')
        setMessage(t('This market is already resolved.'))
        return
      }

      const proposedPrice = getDirectResolutionPrice(selectedOutcome)
      const hash = market.neg_risk
        ? await walletClient.writeContract({
            account: connectedAddress,
            address: getDirectResolutionOracleAddress(),
            abi: DIRECT_RESOLUTION_ORACLE_ABI,
            functionName: 'proposeAndResolveNegRisk',
            args: [
              adapterAddress,
              getDirectResolutionNegRiskOperatorAddress(),
              adapterQuestionId,
              negRiskOperatorQuestionId as Hex,
              YES_OR_NO_IDENTIFIER,
              question.requestTimestamp,
              question.ancillaryData,
              proposedPrice,
            ],
          })
        : await walletClient.writeContract({
            account: connectedAddress,
            address: getDirectResolutionOracleAddress(),
            abi: DIRECT_RESOLUTION_ORACLE_ABI,
            functionName: 'proposeAndResolve',
            args: [
              adapterAddress,
              adapterQuestionId,
              YES_OR_NO_IDENTIFIER,
              question.requestTimestamp,
              question.ancillaryData,
              proposedPrice,
            ],
          })

      await publicClient.waitForTransactionReceipt({ hash })
      setState('submitted')
      setMessage(t('Result submitted. The market should update after the next sync.'))
      toast.success(t('Resolution submitted.'))
    }
    catch (error) {
      console.error('Direct resolution failed:', error)
      setState('error')
      setMessage(error instanceof Error
        ? error.message
        : t('Could not submit resolution.'))
    }
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
              {t('Direct resolution is final as soon as an authorized proposer submits the result.')}
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
