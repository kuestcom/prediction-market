'use client'

import type { CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency, formatSharesLabel } from '@/lib/formatters'
import {
  aggregateSafeTransactions,
  buildRedeemPositionTransaction,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

export interface SportsRedeemModalPosition {
  key: string
  label: string
  shares: number
  value: number
  badgeClassName?: string
  badgeStyle?: CSSProperties
}

export interface SportsRedeemModalGroup {
  conditionId: string
  title: string
  amount: number
  indexSets: number[]
  positions: SportsRedeemModalPosition[]
}

export interface SportsRedeemModalSection {
  key: string
  label: string
  groups: SportsRedeemModalGroup[]
}

interface SportsRedeemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  sections: SportsRedeemModalSection[]
  defaultSelectedSectionKey?: string | null
  defaultSelectedConditionId?: string | null
  onClaimSuccess?: (conditionIds: string[]) => void
}

function resolveGroupAmount(group: SportsRedeemModalGroup) {
  const positionsTotal = group.positions.reduce((sum, position) => {
    const value = Number(position.value)
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)

  if (positionsTotal > 0) {
    return positionsTotal
  }

  return group.amount
}

function markConditionsAsClaimedInPositions<T extends {
  market?: { condition_id?: string | null } | null
  redeemable?: boolean
}>(positions: T[] | undefined, claimedConditionIds: Set<string>): T[] | undefined {
  if (!Array.isArray(positions) || claimedConditionIds.size === 0) {
    return positions
  }

  let hasChanges = false
  const next = positions.map((position) => {
    if (!position || !position.market?.condition_id || position.redeemable === false) {
      return position
    }

    if (!claimedConditionIds.has(position.market.condition_id)) {
      return position
    }

    hasChanges = true
    return {
      ...position,
      redeemable: false,
    }
  })

  return hasChanges ? next : positions
}

export default function SportsRedeemModal({
  open,
  onOpenChange,
  title,
  subtitle,
  sections,
  defaultSelectedSectionKey = null,
  defaultSelectedConditionId = null,
  onClaimSuccess,
}: SportsRedeemModalProps) {
  const isMobile = useIsMobile()
  const user = useUser()
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedConditionIds, setSelectedConditionIds] = useState<Record<string, true>>({})
  const [expandedConditionIds, setExpandedConditionIds] = useState<Record<string, boolean>>({})

  const normalizedSections = useMemo(() => {
    return sections
      .map(section => ({
        ...section,
        groups: section.groups.filter(group => group.indexSets.length > 0 && group.amount > 0),
      }))
      .filter(section => section.groups.length > 0)
  }, [sections])

  const normalizedGroups = useMemo(
    () => normalizedSections.flatMap(section => section.groups),
    [normalizedSections],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const selected: Record<string, true> = {}
    const expanded: Record<string, boolean> = {}

    const preferredGroup = defaultSelectedConditionId
      ? normalizedGroups.find(group => group.conditionId === defaultSelectedConditionId) ?? null
      : null
    const preferredSection = defaultSelectedSectionKey
      ? normalizedSections.find(section => section.key === defaultSelectedSectionKey)
      : null
    const fallbackGroup = preferredSection?.groups[0] ?? normalizedGroups[0] ?? null
    const defaultGroup = preferredGroup ?? fallbackGroup
    if (defaultGroup) {
      selected[defaultGroup.conditionId] = true
    }

    setSelectedConditionIds(selected)
    setExpandedConditionIds(expanded)
  }, [
    defaultSelectedConditionId,
    defaultSelectedSectionKey,
    normalizedGroups,
    normalizedSections,
    open,
  ])

  const selectedGroups = useMemo(
    () => normalizedGroups.filter(group => selectedConditionIds[group.conditionId]),
    [normalizedGroups, selectedConditionIds],
  )

  const selectedAmount = useMemo(() => {
    return selectedGroups.reduce((sum, group) => sum + resolveGroupAmount(group), 0)
  }, [selectedGroups])

  const submitLabel = useMemo(
    () => `Cash out ${formatCurrency(selectedAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [selectedAmount],
  )

  function toggleConditionSelection(conditionId: string) {
    setSelectedConditionIds((current) => {
      const next = { ...current }
      if (next[conditionId]) {
        delete next[conditionId]
      }
      else {
        next[conditionId] = true
      }
      return next
    })
  }

  function toggleConditionExpansion(conditionId: string) {
    setExpandedConditionIds(current => ({
      ...current,
      [conditionId]: !current[conditionId],
    }))
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }

    if (selectedGroups.length === 0) {
      toast.info('No claimable winnings selected.')
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    if (!user?.proxy_wallet_address || !user?.address) {
      toast.error('Deploy your proxy wallet before claiming.')
      return
    }

    setIsSubmitting(true)

    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        if (isTradingAuthRequiredError(nonceResult.error)) {
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        return
      }

      const transactions = selectedGroups.map(group =>
        buildRedeemPositionTransaction({
          conditionId: group.conditionId as `0x${string}`,
          indexSets: group.indexSets,
        }),
      )

      const aggregated = aggregateSafeTransactions(transactions)
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: aggregated,
        nonce: nonceResult.nonce,
      })

      const { signatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await runWithSignaturePrompt(() => signMessageAsync({
        message: { raw: structHash },
      }))

      const payload = {
        type: 'SAFE' as const,
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'redeem_positions',
      }

      const response = await submitSafeTransactionAction(payload)
      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(response.error)
        }
        return
      }

      toast.success('Claim submitted', {
        description: selectedGroups.length > 1
          ? 'We sent claims for your selected markets.'
          : 'We sent your claim transaction.',
      })

      const claimedConditionIds = new Set(selectedGroups.map(group => group.conditionId))
      queryClient.setQueriesData({ queryKey: ['order-panel-user-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))
      queryClient.setQueriesData({ queryKey: ['user-market-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))
      queryClient.setQueriesData({ queryKey: ['event-user-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))
      queryClient.setQueriesData({ queryKey: ['user-event-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))
      queryClient.setQueriesData({ queryKey: ['sports-card-user-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))
      queryClient.setQueriesData({ queryKey: ['sports-event-user-positions'] }, current =>
        markConditionsAsClaimedInPositions(current as any[] | undefined, claimedConditionIds))

      void queryClient.invalidateQueries({ queryKey: ['order-panel-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['event-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-event-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['sports-card-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['sports-event-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })

      onClaimSuccess?.(Array.from(claimedConditionIds))
      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to submit claim.', error)
      toast.error('We could not submit your claim. Please try again.')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const content = (
    <div className="grid gap-4">
      <header className="grid gap-1 text-left">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>
      </header>

      <div className="-mx-4 sm:-mx-6">
        <div className="max-h-[45vh] overflow-y-auto px-4 sm:px-6">
          <div className="grid gap-2">
            {normalizedSections.map((section) => {
              return (
                <section key={section.key} className="grid gap-2">
                  <div className="flex h-10 items-center rounded-md bg-muted px-3">
                    <p className="text-sm font-medium text-foreground">{section.label}</p>
                  </div>

                  <div className="grid gap-2">
                    {section.groups.map((group) => {
                      const isExpanded = Boolean(expandedConditionIds[group.conditionId])
                      const isChecked = Boolean(selectedConditionIds[group.conditionId])
                      const groupAmount = resolveGroupAmount(group)

                      return (
                        <section key={group.conditionId} className="rounded-md">
                          <div className="flex items-center gap-2 p-2.5">
                            <Checkbox
                              checked={isChecked}
                              className={cn(
                                'border-muted-foreground/55 bg-muted/20 text-transparent',
                                isChecked && 'border-primary bg-primary text-foreground',
                              )}
                              onCheckedChange={() => toggleConditionSelection(group.conditionId)}
                              aria-label={`Select ${group.title}`}
                            />
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                              onClick={() => toggleConditionSelection(group.conditionId)}
                            >
                              <span className="truncate text-sm font-medium text-foreground">{group.title}</span>
                              <span className="shrink-0 text-sm font-semibold text-foreground">
                                {formatCurrency(groupAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="
                                inline-flex size-6 items-center justify-center rounded-sm bg-muted text-muted-foreground
                                transition-colors
                                hover:bg-muted/80 hover:text-foreground
                              "
                              onClick={() => toggleConditionExpansion(group.conditionId)}
                            >
                              <ChevronDownIcon
                                className={cn(
                                  'size-3.5 transition-transform',
                                  isExpanded ? 'rotate-180' : 'rotate-0',
                                )}
                              />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="px-2.5 py-2">
                              <div className="grid gap-1.5">
                                {group.positions.map(position => (
                                  <div key={position.key} className="flex items-center justify-between gap-2">
                                    <span
                                      className="
                                        inline-flex min-w-0 items-center rounded-sm px-2.5 py-1 text-xs font-semibold
                                      "
                                      style={position.badgeStyle}
                                    >
                                      <span className={cn('truncate', position.badgeClassName)}>
                                        {formatSharesLabel(position.shares, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                        {' '}
                                        |
                                        {' '}
                                        {position.label}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-sm font-medium text-foreground">
                                      {formatCurrency(position.value, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>

      <Button
        type="button"
        className="h-10 w-full"
        onClick={() => void handleSubmit()}
        disabled={isSubmitting || selectedAmount <= 0 || selectedGroups.length === 0}
      >
        {isSubmitting ? 'Submitting...' : submitLabel}
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full px-4 pt-4 pb-6">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-5 sm:max-w-100">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  )
}
