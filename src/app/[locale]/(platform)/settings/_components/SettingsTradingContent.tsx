'use client'

import type { MarketOrderType, User } from '@/types'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { startTransition, useEffect, useOptimistic, useState } from 'react'
import { toast } from 'sonner'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import { updateTradingSettingsAction } from '@/app/[locale]/(platform)/settings/_actions/update-trading-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Switch } from '@/components/ui/switch'
import { CLOB_ORDER_TYPE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

function useTradingFormState() {
  const [error, setError] = useState<string | null>(null)
  return { error, setError }
}

export default function SettingsTradingContent({ user }: { user: User }) {
  const t = useExtracted()
  const sessionUser = useUser()
  const currentUser = sessionUser ?? user
  const { promptAutoRedeem } = useTradingOnboarding()
  const { error, setError } = useTradingFormState()
  const initialOrderType = (user.settings?.trading?.market_order_type as MarketOrderType) ?? CLOB_ORDER_TYPE.FAK
  const initialShowSlippageWarning = Boolean(user.settings?.trading?.show_slippage_warning)
  const autoRedeemEnabled = Boolean(currentUser.settings?.tradingAuth?.autoRedeem?.enabled)
  const canPromptAutoRedeem = Boolean(sessionUser) && !autoRedeemEnabled
  const orderTypeOptions = [
    {
      value: CLOB_ORDER_TYPE.FAK as MarketOrderType,
      title: t('Fill and Kill (FAK)'),
      description: t('Fills as much as possible at the best available prices and cancels any remaining unfilled portion'),
    },
    {
      value: CLOB_ORDER_TYPE.FOK as MarketOrderType,
      title: t('Fill or Kill (FOK)'),
      description: t('Executes the entire order immediately at the specified price or cancels it completely'),
    },
  ]

  useEffect(function syncFreshSettingsUserState() {
    useUser.setState((previous) => {
      return mergeSessionUserState(previous, user)
    })
  }, [user])

  const [optimisticOrderType, setOptimisticOrderType] = useOptimistic<MarketOrderType, MarketOrderType>(
    initialOrderType,
    (_, nextValue) => nextValue,
  )
  const [optimisticShowSlippageWarning, setOptimisticShowSlippageWarning] = useOptimistic<boolean, boolean>(
    initialShowSlippageWarning,
    (_, nextValue) => nextValue,
  )

  function updateGlobalUser(nextSettings: {
    marketOrderType?: MarketOrderType
    showSlippageWarning?: boolean
  }) {
    useUser.setState((prev) => {
      if (!prev) {
        return prev
      }

      return {
        ...prev,
        settings: {
          ...prev.settings,
          trading: {
            ...prev.settings?.trading,
            ...(nextSettings.marketOrderType === undefined
              ? {}
              : { market_order_type: nextSettings.marketOrderType }),
            ...(nextSettings.showSlippageWarning === undefined
              ? {}
              : { show_slippage_warning: nextSettings.showSlippageWarning }),
          },
        },
      }
    })
  }

  function handleOptionChange(value: MarketOrderType) {
    if (value === optimisticOrderType) {
      return
    }

    const previousValue = optimisticOrderType

    startTransition(() => {
      setOptimisticOrderType(value)
    })

    queueMicrotask(async () => {
      const formData = new FormData()
      formData.set('market_order_type', value)

      const { error } = await updateTradingSettingsAction(formData)

      if (error) {
        startTransition(() => {
          setOptimisticOrderType(previousValue)
        })
        setError(error)
      }
      else {
        setError(error)
        toast.success(t('Trading settings updated.'))
        updateGlobalUser({
          marketOrderType: value,
        })
      }
    })
  }

  function handleSlippageWarningChange(value: boolean) {
    if (value === optimisticShowSlippageWarning) {
      return
    }

    const previousValue = optimisticShowSlippageWarning

    startTransition(() => {
      setOptimisticShowSlippageWarning(value)
    })

    queueMicrotask(async () => {
      const formData = new FormData()
      formData.set('show_slippage_warning', String(value))

      const { error } = await updateTradingSettingsAction(formData)

      if (error) {
        startTransition(() => {
          setOptimisticShowSlippageWarning(previousValue)
        })
        setError(error)
      }
      else {
        setError(error)
        toast.success(t('Trading settings updated.'))
        updateGlobalUser({
          showSlippageWarning: value,
        })
      }
    })
  }

  return (
    <div className="grid gap-8">
      {error && <InputError message={error} />}

      <Form action={() => {}} className="grid gap-6">
        <div className="grid gap-3">
          {orderTypeOptions.map((option) => {
            const isSelected = optimisticOrderType === option.value

            return (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-colors',
                  isSelected ? 'border-primary/80 bg-primary/5' : 'border-border hover:border-primary/60',
                )}
              >
                <input
                  type="radio"
                  name="market-order-type-radio"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => handleOptionChange(option.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <div
                    aria-hidden="true"
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border transition-colors',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}
                  >
                    <div
                      className={cn(
                        'size-2 rounded-full bg-background transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium">{option.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </label>
            )
          })}
        </div>
      </Form>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('Auto-Redeem')}</h2>

        <div className={cn(`
          flex flex-col gap-4 rounded-md border border-border p-4
          sm:flex-row sm:items-center sm:justify-between
        `)}
        >
          <div className="grid gap-1.5">
            <h3 className="text-sm font-medium">{t('Auto-redeem your wins')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('Automatically redeem your winnings from markets when they close. One-time approval, always on.')}
            </p>
          </div>

          <Button
            type="button"
            disabled={!canPromptAutoRedeem}
            onClick={() => {
              if (canPromptAutoRedeem) {
                promptAutoRedeem()
              }
            }}
            className="w-full sm:w-auto"
          >
            {autoRedeemEnabled ? t('Enabled') : t('Enable')}
          </Button>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('Display')}</h2>

        <div className={cn(`
          flex flex-col gap-4 rounded-md border border-border p-4
          sm:flex-row sm:items-center sm:justify-between
        `)}
        >
          <div className="grid gap-1.5">
            <label htmlFor="show-slippage-warning" className="text-sm font-medium">
              {t('Show Slippage Warning')}
            </label>
            <p className="text-sm text-muted-foreground">
              {t('Show a warning when a market order may execute more than 10% away from the best available price.')}
            </p>
          </div>

          <Switch
            id="show-slippage-warning"
            checked={optimisticShowSlippageWarning}
            onCheckedChange={handleSlippageWarningChange}
            className="self-start sm:self-center"
          />
        </div>
      </section>
    </div>
  )
}
