'use client'

import type { Route } from 'next'
import type { AdminCreateEventFormProps } from './admin-create-event-form-types'
import { useEffect } from 'react'
import {
  filterSportsSourceProvidersByCategory,
  SPORTS_SOURCE_PROVIDERS,
} from '@/lib/sports-source/providers'
import { TOTAL_STEPS } from './admin-create-event-form-constants'
import { AdminCreateEventDialogs } from './AdminCreateEventDialogs'
import { AdminCreateEventStepBasics } from './AdminCreateEventStepBasics'
import { AdminCreateEventStepMarketStructure } from './AdminCreateEventStepMarketStructure'
import { AdminCreateEventStepPreSign } from './AdminCreateEventStepPreSign'
import { AdminCreateEventStepResolution } from './AdminCreateEventStepResolution'
import { AdminCreateEventStepSignCreate } from './AdminCreateEventStepSignCreate'
import { AdminCreateEventFooter, AdminCreateEventStepNavigation } from './AdminCreateEventWizardChrome'
import { useAdminCreateEventForm } from './useAdminCreateEventForm'

export default function AdminCreateEventForm({
  sportsSlugCatalog,
  creationMode = 'single',
  initialDraftRecord = null,
  draftId = null,
  initialTitle = '',
  initialSlug = '',
  initialEndDateIso = '',
  allowPastResolutionDate = false,
  hasConfiguredServerSigners = true,
  serverDraftPayload = null,
  serverAssetPayload = null,
  configuredSportsSourceProviders = [],
}: AdminCreateEventFormProps) {
  const hook = useAdminCreateEventForm({
    sportsSlugCatalog,
    creationMode,
    initialDraftRecord,
    draftId,
    initialTitle,
    initialSlug,
    initialEndDateIso,
    allowPastResolutionDate,
    hasConfiguredServerSigners,
    serverDraftPayload,
    serverAssetPayload,
  })

  const {
    router,
    currentStep,
    maxVisitedStep,
    form,
    sportsForm,
    isSigningAuth,
    isPreparingSignaturePlan,
    isExecutingSignatures,
    isFinalizingSignatureFlow,
    isLoadingPendingRequest,
    signatureFlowDone,
    preparedSignaturePlan,
    stepLabels,
    clickableStepMap,
    isStepValid,
    handleSportsFieldChange,
    handleResetFormClick,
    goNext,
    goBack,
    handleStepClick,
    isStepFourPreSignChecksRunning,
    stepFourNextButtonContent,
  } = hook
  const sportsSourceProviderOptions = filterSportsSourceProvidersByCategory({
    providers: configuredSportsSourceProviders,
    category: form.mainCategorySlug,
  })
  const sportsSourceProviderSelectValue = SPORTS_SOURCE_PROVIDERS.includes(sportsForm.sourceProvider as typeof SPORTS_SOURCE_PROVIDERS[number])
    && sportsSourceProviderOptions.includes(sportsForm.sourceProvider as typeof sportsSourceProviderOptions[number])
    ? sportsForm.sourceProvider
    : 'none'

  useEffect(() => {
    if (!sportsForm.sourceProvider || sportsSourceProviderSelectValue !== 'none') {
      return
    }

    handleSportsFieldChange('sourceProvider', '')
    handleSportsFieldChange('sourceEventId', '')
    handleSportsFieldChange('sourceGameId', '')
    handleSportsFieldChange('sourceLeagueId', '')
    handleSportsFieldChange('sourceLeagueLabel', '')
    handleSportsFieldChange('sourceMatchConfidence', '')
  }, [handleSportsFieldChange, sportsForm.sourceProvider, sportsSourceProviderSelectValue])

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <AdminCreateEventStepNavigation
        stepLabels={stepLabels}
        currentStep={currentStep}
        maxVisitedStep={maxVisitedStep}
        clickableStepMap={clickableStepMap}
        isStepValid={isStepValid}
        onStepClick={handleStepClick}
      />

      {currentStep === 1 && (
        <AdminCreateEventStepBasics
          state={hook}
          creationMode={creationMode}
          sportsSlugCatalog={sportsSlugCatalog}
          sportsSourceProviderOptions={sportsSourceProviderOptions}
          sportsSourceProviderSelectValue={sportsSourceProviderSelectValue}
        />
      )}

      {currentStep === 2 && <AdminCreateEventStepMarketStructure state={hook} />}

      {currentStep === 3 && <AdminCreateEventStepResolution state={hook} creationMode={creationMode} />}

      <AdminCreateEventDialogs state={hook} />

      {currentStep === 4 && <AdminCreateEventStepPreSign state={hook} creationMode={creationMode} />}

      {currentStep === 5 && <AdminCreateEventStepSignCreate state={hook} />}

      <AdminCreateEventFooter
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        isLoadingPendingRequest={isLoadingPendingRequest}
        isSigningAuth={isSigningAuth}
        isPreparingSignaturePlan={isPreparingSignaturePlan}
        isExecutingSignatures={isExecutingSignatures}
        isFinalizingSignatureFlow={isFinalizingSignatureFlow}
        isStepFourChecking={isStepFourPreSignChecksRunning}
        signatureFlowDone={signatureFlowDone}
        hasPreparedSignaturePlan={Boolean(preparedSignaturePlan)}
        stepFourNextButtonContent={stepFourNextButtonContent}
        onReset={handleResetFormClick}
        onBack={() => {
          if (currentStep === 1) {
            router.push('/admin/events/calendar' as Route)
            return
          }

          goBack()
        }}
        onNext={goNext}
      />
    </form>
  )
}
