'use client'

import type { ReactNode } from 'react'

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface AdminCreateEventStepNavigationProps {
  stepLabels: string[]
  currentStep: number
  maxVisitedStep: number
  clickableStepMap: Record<number, boolean>
  isStepValid: (step: number) => boolean
  onStepClick: (step: number) => void
}

export function AdminCreateEventStepNavigation({
  stepLabels,
  currentStep,
  maxVisitedStep,
  clickableStepMap,
  isStepValid,
  onStepClick,
}: AdminCreateEventStepNavigationProps) {
  const t = useExtracted()

  return (
    <Card className="bg-background">
      <CardContent className="py-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          {stepLabels.map((label, index) => {
            const step = index + 1
            const active = currentStep === step
            const done = step !== currentStep && step <= maxVisitedStep && isStepValid(step)
            const clickable = clickableStepMap[step]

            return (
              <button
                type="button"
                key={label}
                onClick={() => onStepClick(step)}
                disabled={!clickable}
                className={cn(
                  'rounded-md border p-3 text-left text-sm transition-colors',
                  active && 'border-primary bg-primary/5 font-medium',
                  done && 'border-emerald-600/50',
                  clickable ? 'cursor-pointer hover:border-primary/40' : 'cursor-not-allowed opacity-60',
                )}
              >
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {t('STEP')} {step}
                </p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="text-base font-medium text-foreground">{label}</p>
                  {done && (
                    <span
                      className={cn(
                        `flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-background`,
                      )}
                    >
                      <CheckIcon className="size-3" />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface AdminCreateEventFooterProps {
  currentStep: number
  totalSteps: number
  isLoadingPendingRequest: boolean
  isSigningAuth: boolean
  isPreparingSignaturePlan: boolean
  isExecutingSignatures: boolean
  isFinalizingSignatureFlow: boolean
  isStepFourChecking: boolean
  signatureFlowDone: boolean
  hasPreparedSignaturePlan: boolean
  stepFourNextButtonContent: ReactNode
  onReset: () => void
  onBack: () => void
  onNext: () => void
}

export function AdminCreateEventFooter({
  currentStep,
  totalSteps,
  isLoadingPendingRequest,
  isSigningAuth,
  isPreparingSignaturePlan,
  isExecutingSignatures,
  isFinalizingSignatureFlow,
  isStepFourChecking,
  signatureFlowDone,
  hasPreparedSignaturePlan,
  stepFourNextButtonContent,
  onReset,
  onBack,
  onNext,
}: AdminCreateEventFooterProps) {
  const t = useExtracted()
  const signatureBusy =
    isLoadingPendingRequest ||
    isSigningAuth ||
    isPreparingSignaturePlan ||
    isExecutingSignatures ||
    isFinalizingSignatureFlow

  return (
    <Card className="bg-background">
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('Step')} {currentStep} {t('of')} {totalSteps}
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(
              `border-destructive/30 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive`,
            )}
            onClick={onReset}
            disabled={signatureBusy}
          >
            {t('Reset form')}
          </Button>

          <Button type="button" variant="outline" onClick={onBack} disabled={signatureBusy}>
            <ArrowLeftIcon className="mr-2 size-4" />
            {t('Back')}
          </Button>

          <Button type="button" onClick={onNext} disabled={(currentStep === 4 && isStepFourChecking) || signatureBusy}>
            {currentStep === 5 ? (
              <>
                {signatureBusy && <Spinner className="mr-2 size-4" />}
                {isLoadingPendingRequest
                  ? t('Loading...')
                  : isSigningAuth
                    ? t('Signing auth...')
                    : isPreparingSignaturePlan
                      ? t('Preparing...')
                      : isExecutingSignatures
                        ? t('Signing...')
                        : isFinalizingSignatureFlow
                          ? t('Finalizing...')
                          : signatureFlowDone
                            ? t('Create another event')
                            : hasPreparedSignaturePlan
                              ? t('Continue signatures')
                              : t('Sign & prepare')}
              </>
            ) : currentStep === 4 ? (
              stepFourNextButtonContent
            ) : (
              <>
                {t('Next')}
                <ArrowRightIcon className="ml-2 size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
