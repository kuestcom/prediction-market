'use client'

import { AlertTriangleIcon, InfoIcon, Settings2Icon, WalletIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useRef, useState } from 'react'

import { updateForkSettingsAction } from '@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_NETWORK_KEY } from '@/lib/network'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const initialState = {
  error: null,
}

const OPERATOR_SHARE_MIN = 20
const OPERATOR_SHARE_MAX = 45
const OPERATOR_SHARE_DEFAULT = 30
const OPERATOR_SHARE_STOPS = [20, 30, 37, 45] as const

interface AdminAffiliateSettingsFormProps {
  builderTakerFeeShareBps: number
  builderMakerFlatFeeBps: number
  affiliateShareBps: number
  hasSavedBuilderTakerShare: boolean
  initialFeeRecipientWallet: string
  updatedAtLabel?: string
  onOperatorShareChange?: (value: number) => void
}

interface AdminInfoTooltipProps {
  content: string
}

function AdminInfoTooltip({ content }: AdminInfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              `inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none`,
            )}
            aria-label={content}
          >
            <InfoIcon className="size-4" aria-hidden />
          </button>
        }
      />
      <TooltipContent side="top" className="max-w-72 text-left">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

function useAffiliateSettingsForm() {
  const t = useExtracted()
  const [state, formAction, isPending] = useActionState(updateForkSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  useEffect(
    function toastOnSettingsTransition() {
      const transitionedToIdle = wasPendingRef.current && !isPending

      if (transitionedToIdle && state.error === null) {
        toast.success(t('Settings updated successfully!'))
      } else if (transitionedToIdle && state.error) {
        toast.error(state.error)
      }

      wasPendingRef.current = isPending
    },
    [isPending, state.error, t],
  )

  return { state, formAction, isPending }
}

export default function AdminAffiliateSettingsForm({
  builderTakerFeeShareBps,
  builderMakerFlatFeeBps,
  affiliateShareBps,
  hasSavedBuilderTakerShare,
  initialFeeRecipientWallet,
  updatedAtLabel,
  onOperatorShareChange,
}: AdminAffiliateSettingsFormProps) {
  const t = useExtracted()
  const user = useUser()
  const { state, formAction, isPending } = useAffiliateSettingsForm()
  const formRef = useRef<HTMLFormElement>(null)
  const depositWalletAddress = user?.deposit_wallet_address ?? null
  const [feeRecipientWallet, setFeeRecipientWallet] = useState(initialFeeRecipientWallet)
  const [operatorSharePercent, setOperatorSharePercent] = useState(() =>
    Math.min(OPERATOR_SHARE_MAX, Math.max(OPERATOR_SHARE_MIN, builderTakerFeeShareBps / 100 || OPERATOR_SHARE_DEFAULT)),
  )
  const [makerFeePercent, setMakerFeePercent] = useState((builderMakerFlatFeeBps / 100).toFixed(2))
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false)

  const updatedAtTooltip = updatedAtLabel ? t('Last fees updated {timestamp}', { timestamp: updatedAtLabel }) : null
  const affiliateShareTooltip = t('Commission paid to your affiliates, deducted from your operator fee.')
  const normalizedFeeRecipientWallet = feeRecipientWallet.trim().toLowerCase()
  const normalizedDepositWallet = depositWalletAddress?.trim().toLowerCase() ?? null
  const shouldShowDepositWalletButton =
    Boolean(normalizedDepositWallet) && normalizedFeeRecipientWallet !== normalizedDepositWallet
  const feeWalletLabel =
    DEFAULT_NETWORK_KEY === 'amoy' ? t('Fee Wallet Address (Polygon Amoy)') : t('Fee Wallet Address (Polygon)')

  function handleUseDepositWallet() {
    if (depositWalletAddress) {
      setFeeRecipientWallet(depositWalletAddress)
    }
  }

  const operatorShareLabels = [t('Lower fees'), t('Recommended'), t('Polymarket parity'), t('Aggressive')]
  const operatorShareDescriptions = [
    t('More volume, less profit per trade'),
    t('Balanced volume and profit'),
    t('Less volume, more profit per trade'),
    t('Lowest volume, highest profit per trade'),
  ]
  const activeOperatorShareIndex = OPERATOR_SHARE_STOPS.reduce((nearestIndex, stop, index) => {
    const nearestDistance = Math.abs(OPERATOR_SHARE_STOPS[nearestIndex] - operatorSharePercent)
    return Math.abs(stop - operatorSharePercent) < nearestDistance ? index : nearestIndex
  }, 0)
  const operatorSharePosition =
    ((operatorSharePercent - OPERATOR_SHARE_MIN) / (OPERATOR_SHARE_MAX - OPERATOR_SHARE_MIN)) * 100

  function handleOperatorShareChange(value: number) {
    setOperatorSharePercent(value)
    onOperatorShareChange?.(value)
  }

  const initialOperatorSharePercent = builderTakerFeeShareBps / 100 || OPERATOR_SHARE_DEFAULT
  const initialMakerFeePercent = builderMakerFlatFeeBps / 100
  const feesChanged =
    operatorSharePercent !== initialOperatorSharePercent || Number(makerFeePercent) !== initialMakerFeePercent

  function submitSettings() {
    if (hasSavedBuilderTakerShare && feesChanged) {
      setShowFeeConfirmation(true)
      return
    }

    formRef.current?.requestSubmit()
  }

  function confirmFeeChange() {
    setShowFeeConfirmation(false)
    formRef.current?.requestSubmit()
  }

  return (
    <>
      <Form ref={formRef} action={formAction} className="grid h-full gap-6 rounded-lg border p-6">
        <div>
          <h2 className="text-xl font-semibold">{t('Trading Fees')}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <p>{t('Configure your operator fees and affiliate split.')}</p>
            {updatedAtTooltip && <AdminInfoTooltip content={updatedAtTooltip} />}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fee_recipient_wallet">{feeWalletLabel}</Label>
            <div className="flex w-full items-stretch">
              <Input
                id="fee_recipient_wallet"
                name="fee_recipient_wallet"
                maxLength={42}
                value={feeRecipientWallet}
                disabled={isPending}
                readOnly
                placeholder={t('0xabc')}
                className={cn(
                  'cursor-default bg-muted/40 text-muted-foreground',
                  shouldShowDepositWalletButton && 'rounded-r-none border-r-0',
                )}
              />
              {shouldShowDepositWalletButton && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none border-l-0 px-3"
                  disabled={isPending}
                  onClick={handleUseDepositWallet}
                >
                  <WalletIcon className="size-4" aria-hidden />
                  {t('Use my deposit wallet')}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/20 px-4 py-3">
            <input type="hidden" name="builder_taker_share_percent" value={operatorSharePercent.toFixed(2)} />
            <input type="hidden" name="builder_maker_flat_fee_percent" value={makerFeePercent} />
            <div className="flex items-center justify-between gap-3">
              <Label>{t('Taker share')}</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      disabled={isPending}
                    >
                      <Settings2Icon className="size-3.5" aria-hidden />
                      {t('Maker fee')}
                    </Button>
                  }
                />
                <PopoverContent align="end" className="w-72">
                  <PopoverTitle>{t('Maker fee')}</PopoverTitle>
                  <p className="text-xs text-muted-foreground">{t('Kuest maker fee: 0%.')}</p>
                  <div className="flex items-start">
                    <Input
                      id="builder_maker_flat_fee_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={makerFeePercent}
                      disabled={isPending}
                      className="rounded-r-none"
                      onChange={(event) => setMakerFeePercent(event.target.value)}
                    />
                    <span className="flex h-9 w-10 shrink-0 items-center justify-center self-start rounded-r-md border border-l-0 bg-muted text-sm leading-none text-muted-foreground">
                      %
                    </span>
                  </div>
                  {Number(makerFeePercent) > 0 && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />
                      {t('Recommended: 0%. Maker fees may reduce liquidity.')}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="px-2 pt-7 pb-1">
              <div className="relative">
                <span
                  className="pointer-events-none absolute bottom-6 z-10 -translate-x-1/2 rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums shadow-sm"
                  style={{ left: `calc(${operatorSharePosition}% + ${10 - operatorSharePosition * 0.2}px)` }}
                >
                  {operatorSharePercent}%
                </span>
                <Slider
                  min={OPERATOR_SHARE_MIN}
                  max={OPERATOR_SHARE_MAX}
                  step={1}
                  value={operatorSharePercent}
                  disabled={isPending}
                  thumbAlignment="center"
                  thumbAriaLabel={t('Taker share')}
                  className="px-[10px]"
                  controlClassName="py-2"
                  trackClassName="h-1 bg-muted-foreground/25"
                  thumbClassName="size-5 border-2 border-background bg-primary shadow-sm"
                  trackChildren={OPERATOR_SHARE_STOPS.map((stop) => {
                    const position = ((stop - OPERATOR_SHARE_MIN) / (OPERATOR_SHARE_MAX - OPERATOR_SHARE_MIN)) * 100
                    return (
                      <span
                        key={stop}
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 block size-2 -translate-1/2 rounded-full bg-primary"
                        style={{ left: `${position}%` }}
                      />
                    )
                  })}
                  onValueChange={handleOperatorShareChange}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-xs">
                <strong className="font-semibold text-foreground">
                  {operatorShareLabels[activeOperatorShareIndex]}
                </strong>
                <span aria-hidden className="text-border">
                  •
                </span>
                <span className="text-muted-foreground">{operatorShareDescriptions[activeOperatorShareIndex]}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="affiliate_share_percent">{t('Affiliate share (%)').replace(/\s*\(%\)\s*$/u, '')}</Label>
                <AdminInfoTooltip content={affiliateShareTooltip} />
              </div>
              <div className="flex items-start">
                <Input
                  id="affiliate_share_percent"
                  name="affiliate_share_percent"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  defaultValue={(affiliateShareBps / 100).toFixed(2)}
                  disabled={isPending}
                  className="rounded-r-none"
                />
                <span className="flex h-9 w-10 shrink-0 items-center justify-center self-start rounded-r-md border border-l-0 bg-muted text-sm leading-none text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <Button type="button" className="w-full" disabled={isPending} onClick={submitSettings}>
              {isPending ? t('Saving...') : t('Save changes')}
            </Button>
          </div>
        </div>

        {state.error && <InputError message={state.error} />}
      </Form>

      <Dialog open={showFeeConfirmation} onOpenChange={setShowFeeConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Change trading fees?')}</DialogTitle>
            <DialogDescription>
              {t('Fee changes affect future trades and trader trust. Notify your customers before continuing.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('Taker share')}</span>
              <span className="font-medium tabular-nums">
                {initialOperatorSharePercent}% → {operatorSharePercent}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t('Maker fee')}</span>
              <span className="font-medium tabular-nums">
                {initialMakerFeePercent.toFixed(2)}% → {Number(makerFeePercent || 0).toFixed(2)}%
              </span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t('Cancel')}</DialogClose>
            <Button type="button" onClick={confirmFeeChange}>
              {t('Confirm change')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
