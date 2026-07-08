'use client'

import type { Route } from 'next'

import type {
  AdminCreateEventFormProps,
} from './admin-create-event-form-types'
import type {
  AdminSportsFormState,
} from '@/lib/admin-sports-create'
import type { EventCreationRecurrenceUnit } from '@/lib/event-creation'
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  ImageUp,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  SquarePenIcon,
  Trash2Icon,
  UserCheckIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import AppLink from '@/components/AppLink'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getAdminSportsMarketTypeDefaultOutcomes,
  resolveAdminSportsMarketTypeOption,
} from '@/lib/admin-sports-create'
import {
  filterSportsSourceProvidersByCategory,
  formatSportsSourceProviderLabel,
  SPORTS_SOURCE_PROVIDERS,
} from '@/lib/sports-source/providers'

import { cn } from '@/lib/utils'

import {
  CUSTOM_SPORTS_SLUG_SELECT_VALUE,
  RECURRENCE_OPTIONS,
  TEMPLATE_TOKEN_EXAMPLES,
  TEMPLATE_TOKEN_HELP_TEXT,
  TOTAL_STEPS,
} from './admin-create-event-form-constants'
import { CheckIndicator, OutcomeStateDot, SignatureTxIndicator } from './admin-create-event-form-indicators'
import {
  getCheckIndicatorState,
} from './admin-create-event-form-signature-helpers'
import {
  formatEventScheduleLabel,
  getAiIssueKey,
  getChainLabel,
  getExplorerTxBase,
} from './admin-create-event-form-utils'
import { AdminCreateEventFooter, AdminCreateEventStepNavigation } from './AdminCreateEventWizardChrome'
import { useAdminCreateEventForm } from './useAdminCreateEventForm'

const UMA_RESOLUTION_TEMPORARILY_DISABLED = true
const AdminProposersDialog = dynamic(() => import('./AdminProposersDialog'), {
  ssr: false,
})

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
  const t = useExtracted()
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
    eoaAddress,
    eoaShortAddress,
    selectedCreatorAddress,
    currentStep,
    maxVisitedStep,
    form,
    titleTemplate,
    setTitleTemplate,
    setSlugTemplate,
    automaticWalletAddress,
    setAutomaticWalletAddress,
    recurrenceUnit,
    setRecurrenceUnit,
    recurrenceInterval,
    setRecurrenceInterval,
    signers,
    isLoadingSigners,
    sportsForm,
    defaultSportsMatchQuery,
    sportsMatchQuery,
    setSportsMatchQuery,
    sportsMatchCandidates,
    selectedSportsMatch,
    isSearchingSportsMatches,
    sportsMatchError,
    mainCategories,
    categoryQuery,
    setCategoryQuery,
    slugValidationState,
    slugCheckError,
    resolutionType,
    handleResolutionTypeChange,
    requiredRewardUsdc,
    eoaUsdcBalance,
    fundingCheckState,
    fundingCheckError,
    eoaPolBalance,
    requiredGasPol,
    nativeGasCheckState,
    nativeGasCheckError,
    allowedCreatorCheckState,
    allowedCreatorCheckError,
    proposerWhitelistCheckState,
    proposerWhitelistCheckError,
    openRouterCheckState,
    openRouterCheckError,
    contentCheckWarnings,
    contentCheckProgressLine,
    contentCheckError,
    isAddingCreatorWallet,
    creatorWalletDialogOpen,
    setCreatorWalletDialogOpen,
    proposersDialogOpen,
    setProposersDialogOpen,
    creatorWalletName,
    setCreatorWalletName,
    isGeneratingRules,
    isSigningAuth,
    isPreparingSignaturePlan,
    isExecutingSignatures,
    isFinalizingSignatureFlow,
    isLoadingPendingRequest,
    signatureFlowDone,
    signatureFlowError,
    pendingWorkflowRequestId,
    pendingWorkflowStatus,
    preparedSignaturePlan,
    signatureTxs,
    expandedPreSignChecks,
    rulesGeneratorDialogOpen,
    setRulesGeneratorDialogOpen,
    finalPreviewDialogOpen,
    setFinalPreviewDialogOpen,
    resetFormDialogOpen,
    setResetFormDialogOpen,
    isAddressCopied,
    isBinaryOutcomesEditable,
    setIsBinaryOutcomesEditable,
    areMultiOutcomesEditable,
    setAreMultiOutcomesEditable,
    isCustomSportSlug,
    isCustomLeagueSlug,
    eventEndDateInputRef,
    sportsStartTimeInputRef,
    eventImagePreviewUrl,
    optionImagePreviewUrls,
    teamLogoPreviewUrls,
    selectedMainCategory,
    isSportsEvent,
    sportsMarketTypeGroups,
    availableLeagueOptions,
    sportSlugSelectValue,
    leagueSlugSelectValue,
    sportsDerivedContent,
    marketCount,
    requiredTotalRewardUsdc,
    optionQuestionPlaceholder,
    optionNamePlaceholder,
    optionShortNamePlaceholder,
    filteredCategorySuggestions,
    selectedCategoryChips,
    sportsCustomCategoryChips,
    hasRecurringDeployHistory,
    automaticDeployAtDate,
    nextRecurringResolutionDate,
    nextRecurringDeployDate,
    recurringResolvedTitle,
    effectiveRecurringSlugTemplate,
    recurringResolvedSlug,
    recurringResolvedRules,
    effectiveResolutionRules,
    recurringOccurrencePreviews,
    recurringEditorialWarnings,
    recurringRequiresServerWalletSetup,
    stepLabels,
    previewEndDate,
    previewTitle,
    previewMarkets,
    tradePreviewMarket,
    previewEventUrl,
    isMultiMarketPreview,
    pendingAiIssues,
    fundingHasIssue,
    nativeGasHasIssue,
    allowedCreatorHasIssue,
    proposerWhitelistHasIssue,
    slugHasIssue,
    openRouterHasIssue,
    contentHasIssue,
    contentIndicatorState,
    finalizeInProgressAccepted,
    finalizeStepSucceeded,
    finalizeStepIsRunning,
    finalizeStepHasError,
    totalSignatureUnits,
    completedSignatureUnits,
    signatureProgressPercent,
    authChallengeRemainingSeconds,
    authChallengeCountdownLabel,
    clickableStepMap,
    isStepValid,
    handleSportsFieldChange,
    handleSportsTeamChange,
    applySportsMatchCandidate,
    clearSportsMatchCandidate,
    searchSportsMatches,
    handleSportsTeamLogoUpload,
    handleSportsPropChange,
    handleSportSlugSelectChange,
    handleLeagueSlugSelectChange,
    addSportsProp,
    removeSportsProp,
    handleSportsCustomMarketChange,
    addSportsCustomMarket,
    removeSportsCustomMarket,
    handleFieldChange,
    handleEndDateInputValueChange,
    handleSportsStartTimeInputValueChange,
    addCategory,
    addCategoryFromInput,
    removeCategory,
    handleEventImageUpload,
    handleOptionChange,
    addOption,
    removeOption,
    handleOptionImageUpload,
    copyWalletAddress,
    openAdminSettings,
    handleResetFormClick,
    confirmResetForm,
    goNext,
    goBack,
    handleStepClick,
    bypassIssue,
    goToIssueStep,
    togglePreSignCheck,
    continueFromFinalPreview,
    generateRulesWithAi,
    addCurrentWalletToAllowedCreators,
    runProposerWhitelistCheck,
    setProposerWhitelistCheckState,
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
        <div className="space-y-6">
          <Card className="bg-background">
            <CardHeader className="pt-8 pb-6">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="size-5" />
                Event details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_1fr]">
                <div className="space-y-3">
                  <Label htmlFor="event-image">Event image</Label>
                  <Input
                    id="event-image"
                    type="file"
                    accept="image/*"
                    onChange={handleEventImageUpload}
                    className="sr-only"
                  />
                  <label
                    htmlFor="event-image"
                    className={cn(`
                      group relative flex size-56 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                      border border-dashed border-border bg-muted/20 text-muted-foreground transition
                      hover:border-primary/60
                    `)}
                  >
                    <span className={cn(`
                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                      group-hover:bg-foreground/5
                    `)}
                    />
                    {eventImagePreviewUrl
                      ? (
                          <EventIconImage
                            src={eventImagePreviewUrl}
                            alt="Event image preview"
                            sizes="256px"
                            unoptimized
                            containerClassName="size-full"
                          />
                        )
                      : (
                          <div className="text-sm text-muted-foreground">256 × 256 preview</div>
                        )}
                    <ImageUp
                      className={cn(`
                        pointer-events-none absolute top-1/2 left-1/2 z-10 size-7 -translate-1/2 text-foreground/70
                        opacity-0 transition
                        group-hover:opacity-100
                      `)}
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="event-title">
                        {creationMode === 'recurring' ? 'Title template' : 'Event title'}
                      </Label>
                      {creationMode === 'recurring' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-2">
                              <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                              {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                                <p key={`title-token-${item}`}>{item}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="event-title"
                      value={creationMode === 'recurring' ? titleTemplate : form.title}
                      onChange={event => (
                        creationMode === 'recurring'
                          ? setTitleTemplate(event.target.value)
                          : handleFieldChange('title', event.target.value)
                      )}
                      placeholder={creationMode === 'recurring'
                        ? 'Example: BTC UP or DOWN on {{date}}?'
                        : 'Example: Will the U.S. Senate pass the budget by March 31, 2026?'}
                    />
                    {creationMode === 'recurring' && recurringResolvedTitle && (
                      <p className="text-xs text-muted-foreground">
                        Preview:
                        {' '}
                        {recurringResolvedTitle}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="event-slug">
                        {creationMode === 'recurring' ? 'Slug template' : 'Slug'}
                      </Label>
                      {creationMode === 'recurring' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-2">
                              <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                              {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                                <p key={`slug-token-${item}`}>{item}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Input
                      id="event-slug"
                      value={creationMode === 'recurring' ? effectiveRecurringSlugTemplate : form.slug}
                      readOnly={creationMode !== 'recurring'}
                      onChange={event => setSlugTemplate(event.target.value)}
                      placeholder={creationMode === 'recurring' ? 'Example: btc-above-120k-{{day}}-{{month_name_lower}}' : ''}
                    />
                    {creationMode === 'recurring' && recurringResolvedSlug && (
                      <p className="text-xs text-muted-foreground">
                        Preview:
                        {' '}
                        {recurringResolvedSlug}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="event-end-date">
                          {creationMode === 'recurring'
                            ? (hasRecurringDeployHistory ? 'Next resolution date' : 'First resolution date')
                            : 'Resolution date'}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground transition hover:text-foreground">
                              <CircleHelpIcon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-left">
                            <div className="grid gap-1">
                              {creationMode === 'recurring'
                                ? (
                                    <>
                                      <p>This date is always the resolution date for the occurrence shown here.</p>
                                      <p>
                                        {hasRecurringDeployHistory
                                          ? (
                                              automaticDeployAtDate
                                                ? `This occurrence becomes deployable on ${formatEventScheduleLabel(automaticDeployAtDate)}.`
                                                : 'Set the recurrence cadence to calculate the automatic deploy time.'
                                            )
                                          : 'The first recurring event becomes deployable immediately after saving.'}
                                      </p>
                                    </>
                                  )
                                : (
                                    <p>This date is the resolution date. Unique events go live when you sign and deploy them manually.</p>
                                  )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          ref={eventEndDateInputRef}
                          id="event-end-date"
                          type="datetime-local"
                          value={form.endDateIso}
                          onChange={event => handleEndDateInputValueChange(event.currentTarget.value)}
                          onInput={event => handleEndDateInputValueChange(event.currentTarget.value)}
                          aria-describedby={!form.endDateIso ? 'event-end-date-hint' : undefined}
                          required
                          className="w-full md:max-w-[240px]"
                        />
                        {creationMode === 'recurring'
                          ? (
                              <>
                                {nextRecurringResolutionDate && nextRecurringDeployDate && (
                                  <p className="text-xs text-muted-foreground">
                                    Next cycle preview:
                                    {' '}
                                    resolves on
                                    {' '}
                                    {formatEventScheduleLabel(nextRecurringResolutionDate)}
                                    {' '}
                                    and becomes deployable on
                                    {' '}
                                    {formatEventScheduleLabel(nextRecurringDeployDate)}
                                    .
                                  </p>
                                )}
                              </>
                            )
                          : null}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label>Creator</Label>
                      <Select
                        value={creationMode === 'recurring'
                          ? (automaticWalletAddress || undefined)
                          : (automaticWalletAddress || (eoaAddress ? '__eoa__' : undefined))}
                        onValueChange={value => setAutomaticWalletAddress(value === '__eoa__' ? '' : value)}
                      >
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder={creationMode === 'recurring'
                            ? (isLoadingSigners ? 'Loading creators...' : 'Select creator')
                            : (eoaAddress ? 'EOA wallet' : 'Connect EOA wallet')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {creationMode !== 'recurring' && eoaAddress && (
                            <SelectItem value="__eoa__">
                              EOA wallet
                              {' · '}
                              {eoaShortAddress}
                            </SelectItem>
                          )}
                          {signers.map(signer => (
                            <SelectItem key={signer.address} value={signer.address}>
                              {signer.displayName}
                              {' · '}
                              {signer.shortAddress}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {creationMode === 'recurring' && (
                    <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor="recurrence-interval">Every</Label>
                        <Input
                          id="recurrence-interval"
                          inputMode="numeric"
                          value={recurrenceInterval}
                          onChange={event => setRecurrenceInterval(event.currentTarget.value.replace(/\D/g, '') || '1')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Recurrence</Label>
                        <Select
                          value={recurrenceUnit || undefined}
                          onValueChange={value => setRecurrenceUnit(value as EventCreationRecurrenceUnit)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select cadence" />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardHeader className="pt-8 pb-6">
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="main-category">Main category</Label>
                <Select
                  value={form.mainCategorySlug || undefined}
                  onValueChange={value => handleFieldChange('mainCategorySlug', value)}
                >
                  <SelectTrigger id="main-category" className="w-full">
                    <SelectValue placeholder="Select main category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map(category => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSportsEvent
                ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="sports-section">Sports sub category</Label>
                          <Select
                            value={sportsForm.section || undefined}
                            onValueChange={value => handleSportsFieldChange('section', value as AdminSportsFormState['section'])}
                          >
                            <SelectTrigger id="sports-section" className="w-full">
                              <SelectValue placeholder="Select Games or Props" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="games">Games</SelectItem>
                              <SelectItem value="props">Props</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <details className="rounded-md border border-border bg-muted/10 p-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          {selectedSportsMatch
                            ? t('Sports match: {match}', {
                                match: [
                                  selectedSportsMatch.homeTeam?.name,
                                  selectedSportsMatch.awayTeam?.name,
                                ].filter(Boolean).join(' vs ') || selectedSportsMatch.eventId,
                              })
                            : t('Sports match')}
                        </summary>

                        <div className="mt-4 grid gap-3">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={sportsMatchQuery}
                              onChange={event => setSportsMatchQuery(event.target.value)}
                              placeholder={defaultSportsMatchQuery || form.title || t('Search match')}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void searchSportsMatches()
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void searchSportsMatches()}
                              disabled={isSearchingSportsMatches}
                            >
                              {isSearchingSportsMatches
                                ? <Loader2Icon className="size-4 animate-spin" />
                                : <SearchIcon className="size-4" />}
                              <span>{t('Search')}</span>
                            </Button>
                            {selectedSportsMatch
                              ? (
                                  <Button type="button" variant="outline" onClick={clearSportsMatchCandidate}>
                                    {t('Clear')}
                                  </Button>
                                )
                              : null}
                          </div>

                          {sportsMatchError
                            ? <p className="text-sm text-destructive">{sportsMatchError}</p>
                            : null}

                          {sportsMatchCandidates.length > 0
                            ? (
                                <div className="grid gap-2">
                                  {sportsMatchCandidates.map(candidate => (
                                    <button
                                      key={`${candidate.provider}:${candidate.eventId}:${candidate.gameId ?? ''}`}
                                      type="button"
                                      className={cn(`
                                        flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background
                                        px-3 py-2 text-left text-sm transition
                                        hover:border-primary/60
                                      `)}
                                      onClick={() => applySportsMatchCandidate(candidate)}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                          {[candidate.homeTeam?.name, candidate.awayTeam?.name].filter(Boolean).join(' vs ') || candidate.eventId}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                          {[candidate.leagueName, candidate.startTime ? formatEventScheduleLabel(new Date(candidate.startTime)) : null, candidate.provider]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </span>
                                      </span>
                                      <span className="shrink-0 text-xs text-muted-foreground">
                                        {Math.round((candidate.confidence ?? 0) * 100)}
                                        %
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )
                            : null}

                          <div className="
                            grid grid-cols-1 gap-3 border-t border-border/50 pt-3
                            sm:grid-cols-2
                            lg:grid-cols-4
                          "
                          >
                            <div className="space-y-1.5">
                              <Label htmlFor="sports-source-provider">{t('Provider')}</Label>
                              <Select
                                value={sportsSourceProviderSelectValue}
                                onValueChange={value => handleSportsFieldChange('sourceProvider', value === 'none' ? '' : value)}
                              >
                                <SelectTrigger id="sports-source-provider" className="w-full">
                                  <SelectValue placeholder={t('Provider')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t('None')}</SelectItem>
                                  {sportsSourceProviderOptions.map(provider => (
                                    <SelectItem key={provider} value={provider}>
                                      {formatSportsSourceProviderLabel(provider)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="sports-source-event-id">{t('Event ID')}</Label>
                              <Input
                                id="sports-source-event-id"
                                value={sportsForm.sourceEventId}
                                onChange={event => handleSportsFieldChange('sourceEventId', event.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="sports-source-game-id">{t('Game ID')}</Label>
                              <Input
                                id="sports-source-game-id"
                                value={sportsForm.sourceGameId}
                                onChange={event => handleSportsFieldChange('sourceGameId', event.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="sports-source-league-id">{t('League ID')}</Label>
                              <Input
                                id="sports-source-league-id"
                                value={sportsForm.sourceLeagueId}
                                onChange={event => handleSportsFieldChange('sourceLeagueId', event.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </details>

                      {sportsForm.section === 'games' && (
                        <>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="sports-start-time">Game start time</Label>
                              <Input
                                ref={sportsStartTimeInputRef}
                                id="sports-start-time"
                                type="datetime-local"
                                value={sportsForm.startTime}
                                onChange={event => handleSportsStartTimeInputValueChange(event.currentTarget.value)}
                                onInput={event => handleSportsStartTimeInputValueChange(event.currentTarget.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="sports-sport-slug">Sport slug</Label>
                              <Select value={sportSlugSelectValue} onValueChange={handleSportSlugSelectChange}>
                                <SelectTrigger id="sports-sport-slug" className="w-full">
                                  <SelectValue placeholder="Select sport slug" />
                                </SelectTrigger>
                                <SelectContent>
                                  {sportsSlugCatalog.sportOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={CUSTOM_SPORTS_SLUG_SELECT_VALUE}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {isCustomSportSlug && (
                                <Input
                                  value={sportsForm.sportSlug}
                                  onChange={event => handleSportsFieldChange('sportSlug', event.target.value)}
                                  placeholder="Example: soccer"
                                />
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="sports-league-slug">League slug</Label>
                              <Select value={leagueSlugSelectValue} onValueChange={handleLeagueSlugSelectChange}>
                                <SelectTrigger id="sports-league-slug" className="w-full">
                                  <SelectValue placeholder="Select league slug" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableLeagueOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={CUSTOM_SPORTS_SLUG_SELECT_VALUE}>Custom</SelectItem>
                                </SelectContent>
                              </Select>
                              {isCustomLeagueSlug && (
                                <Input
                                  value={sportsForm.leagueSlug}
                                  onChange={event => handleSportsFieldChange('leagueSlug', event.target.value)}
                                  placeholder="Example: premier-league"
                                />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {sportsForm.teams.map(team => (
                              <div key={team.hostStatus} className="space-y-4 rounded-md border p-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">
                                    {team.hostStatus === 'home' ? 'Home team' : 'Away team'}
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`sports-team-name-${team.hostStatus}`}>Team name</Label>
                                  <Input
                                    id={`sports-team-name-${team.hostStatus}`}
                                    value={team.name}
                                    onChange={event => handleSportsTeamChange(team.hostStatus, 'name', event.target.value)}
                                    placeholder={team.hostStatus === 'home' ? 'Example: Barcelona' : 'Example: Real Madrid'}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`sports-team-abbreviation-${team.hostStatus}`}>Abbreviation (optional)</Label>
                                  <Input
                                    id={`sports-team-abbreviation-${team.hostStatus}`}
                                    value={team.abbreviation}
                                    onChange={event => handleSportsTeamChange(team.hostStatus, 'abbreviation', event.target.value)}
                                    placeholder={team.hostStatus === 'home' ? 'BAR' : 'RMA'}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Team logo</Label>
                                  <Input
                                    id={`sports-team-logo-${team.hostStatus}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={event => handleSportsTeamLogoUpload(team.hostStatus, event)}
                                    className="sr-only"
                                  />
                                  <label
                                    htmlFor={`sports-team-logo-${team.hostStatus}`}
                                    className={cn(`
                                      group relative flex size-28 cursor-pointer items-center justify-center
                                      overflow-hidden rounded-xl border border-dashed border-border bg-muted/20
                                      text-muted-foreground transition
                                      hover:border-primary/60
                                    `)}
                                  >
                                    <span className={cn(`
                                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                                      group-hover:bg-foreground/5
                                    `)}
                                    />
                                    {teamLogoPreviewUrls[team.hostStatus]
                                      ? (
                                          <EventIconImage
                                            src={teamLogoPreviewUrls[team.hostStatus]!}
                                            alt={`${team.name || team.hostStatus} logo preview`}
                                            sizes="256px"
                                            unoptimized
                                            containerClassName="size-full"
                                          />
                                        )
                                      : (
                                          <div className="text-sm text-muted-foreground">Upload logo</div>
                                        )}
                                    <ImageUp
                                      className={cn(`
                                        pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2
                                        text-foreground/70 opacity-0 transition
                                        group-hover:opacity-100
                                      `)}
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>
                          Generated categories (
                          {sportsDerivedContent.categories.length}
                          )
                        </Label>
                        {sportsDerivedContent.categories.length === 0
                          ? (
                              <p className="text-sm text-muted-foreground">
                                Sports categories are generated automatically from the selected sports settings.
                              </p>
                            )
                          : (
                              <div className="flex flex-wrap gap-2">
                                {sportsDerivedContent.categories.map(item => (
                                  <div
                                    key={item.slug}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
                                      item.slug === selectedMainCategory?.slug && 'border-primary/40 bg-primary/10',
                                    )}
                                  >
                                    <span>{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category-input">Custom categories</Label>
                        <div className="flex gap-2">
                          <Input
                            id="category-input"
                            value={categoryQuery}
                            onChange={event => setCategoryQuery(event.target.value)}
                            placeholder="Add custom sports categories."
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addCategoryFromInput()
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={addCategoryFromInput}>Add</Button>
                        </div>
                      </div>

                      {filteredCategorySuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {filteredCategorySuggestions.map(item => (
                            <Button key={item.slug} type="button" size="sm" variant="outline" onClick={() => addCategory(item)}>
                              {item.name}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>
                          Custom categories (
                          {sportsCustomCategoryChips.length}
                          )
                        </Label>
                        {sportsCustomCategoryChips.length === 0
                          ? (
                              <p className="text-sm text-muted-foreground">No custom categories selected.</p>
                            )
                          : (
                              <div className="flex flex-wrap gap-2">
                                {sportsCustomCategoryChips.map(item => (
                                  <div
                                    key={item.slug}
                                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                                  >
                                    <span>{item.label}</span>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => removeCategory(item.slug)}
                                      aria-label={`Remove ${item.label}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                      </div>
                    </>
                  )
                : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="category-input">Sub categories</Label>
                        <div className="flex gap-2">
                          <Input
                            id="category-input"
                            value={categoryQuery}
                            onChange={event => setCategoryQuery(event.target.value)}
                            placeholder="Add at least 4 additional sub categories."
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addCategoryFromInput()
                              }
                            }}
                          />
                          <Button type="button" variant="outline" onClick={addCategoryFromInput}>Add</Button>
                        </div>
                      </div>

                      {filteredCategorySuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {filteredCategorySuggestions.map(item => (
                            <Button key={item.slug} type="button" size="sm" variant="outline" onClick={() => addCategory(item)}>
                              {item.name}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>
                          Selected categories (
                          {selectedCategoryChips.length}
                          )
                        </Label>
                        {selectedCategoryChips.length === 0
                          ? (
                              <p className="text-sm text-muted-foreground">No categories selected.</p>
                            )
                          : (
                              <div className="flex flex-wrap gap-2">
                                {selectedCategoryChips.map(item => (
                                  <div
                                    key={item.slug}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm',
                                      item.slug === selectedMainCategory?.slug && 'border-primary/40 bg-primary/10',
                                    )}
                                  >
                                    <span>{item.label}</span>
                                    {item.slug === selectedMainCategory?.slug && (
                                      <span className="text-sm text-primary">Main</span>
                                    )}
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => removeCategory(item.slug)}
                                      disabled={item.slug === selectedMainCategory?.slug}
                                      aria-label={`Remove ${item.label}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                      </div>
                    </>
                  )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 2 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="size-5" />
              Market structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            {isSportsEvent
              ? (
                  <>
                    {sportsForm.section && (
                      <div className="space-y-2">
                        <Label htmlFor="sports-event-variant">Sports template</Label>
                        <Select
                          value={sportsForm.eventVariant || undefined}
                          onValueChange={value => handleSportsFieldChange('eventVariant', value as AdminSportsFormState['eventVariant'])}
                        >
                          <SelectTrigger id="sports-event-variant" className="w-full md:max-w-md">
                            <SelectValue placeholder="Select a sports template" />
                          </SelectTrigger>
                          <SelectContent>
                            {sportsForm.section === 'games'
                              ? (
                                  <>
                                    <SelectItem value="standard">Standard game lines</SelectItem>
                                    <SelectItem value="more_markets">Soccer More Markets</SelectItem>
                                    <SelectItem value="exact_score">Exact Score</SelectItem>
                                    <SelectItem value="halftime_result">Halftime Result</SelectItem>
                                    <SelectItem value="custom">Custom sports market types</SelectItem>
                                  </>
                                )
                              : (
                                  <>
                                    <SelectItem value="standard">Player props</SelectItem>
                                    <SelectItem value="custom">Custom sports market types</SelectItem>
                                  </>
                                )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {sportsForm.section === 'games' && sportsForm.eventVariant && (
                      <div className="space-y-3 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {sportsForm.eventVariant === 'standard' ? 'Standard game lines' : 'Moneyline base markets'}
                          </p>
                          {sportsForm.eventVariant !== 'standard' && (
                            <p className="text-sm text-muted-foreground">
                              The base game market is always created for sports games. Use this toggle to decide whether the base moneyline should include home / draw / away or only home / away.
                            </p>
                          )}
                        </div>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeDraw}
                            onChange={event => handleSportsFieldChange('includeDraw', event.target.checked)}
                          />
                          Include draw market in addition to home and away.
                        </label>
                      </div>
                    )}

                    {sportsForm.section === 'games' && sportsForm.eventVariant === 'more_markets' && (
                      <div className="space-y-3 rounded-md border p-4">
                        <p className="text-sm font-medium">More Markets packs</p>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeBothTeamsToScore}
                            onChange={event => handleSportsFieldChange('includeBothTeamsToScore', event.target.checked)}
                          />
                          Both Teams to Score
                        </label>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeTotals}
                            onChange={event => handleSportsFieldChange('includeTotals', event.target.checked)}
                          />
                          Totals pack with fixed ladder 1.5 / 2.5 / 3.5 / 4.5
                        </label>
                        <label className="flex items-center gap-3 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded-sm border"
                            checked={sportsForm.includeSpreads}
                            onChange={event => handleSportsFieldChange('includeSpreads', event.target.checked)}
                          />
                          Spreads pack with fixed ladder -1.5 for home and away
                        </label>
                      </div>
                    )}

                    {sportsForm.section === 'games' && (sportsForm.eventVariant === 'exact_score' || sportsForm.eventVariant === 'halftime_result') && (
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">
                          This pack is generated automatically from the selected teams and start time, and always includes the mandatory moneyline base markets using the draw selection above.
                        </p>
                      </div>
                    )}

                    {sportsForm.eventVariant === 'custom' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Custom sports markets</p>
                          <p className="text-sm text-muted-foreground">
                            Choose any market type. Moneyline base markets are added automatically using the draw selection above, and row order is sent as the market group threshold automatically.
                          </p>
                        </div>

                        {sportsForm.customMarkets.map((market, index) => {
                          const marketTypeOption = resolveAdminSportsMarketTypeOption(market.sportsMarketType)
                          const defaultOutcomes = getAdminSportsMarketTypeDefaultOutcomes(market.sportsMarketType, {
                            homeTeamName: sportsForm.teams[0]?.name ?? '',
                            awayTeamName: sportsForm.teams[1]?.name ?? '',
                          })

                          return (
                            <div key={market.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                              <div className="space-y-2 md:col-span-2">
                                <div className="flex items-center justify-between gap-3">
                                  <Label htmlFor={`sports-custom-market-type-${market.id}`}>
                                    Market
                                    {' '}
                                    {index + 1}
                                  </Label>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removeSportsCustomMarket(market.id)}>
                                    <Trash2Icon className="mr-2 size-4" />
                                    Remove
                                  </Button>
                                </div>
                                <Select
                                  value={market.sportsMarketType || undefined}
                                  onValueChange={value => handleSportsCustomMarketChange(market.id, 'sportsMarketType', value)}
                                >
                                  <SelectTrigger id={`sports-custom-market-type-${market.id}`} className="w-full">
                                    <SelectValue placeholder="Select a sports market type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sportsMarketTypeGroups.map(group => (
                                      <SelectGroup key={group.label}>
                                        <SelectLabel>{group.label}</SelectLabel>
                                        {group.options.map(option => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Question</Label>
                                <Input
                                  value={market.question}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'question', event.target.value)}
                                  placeholder={marketTypeOption?.label
                                    ? `Example: ${marketTypeOption.label}`
                                    : 'Example: 1H Moneyline'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                  value={market.title}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'title', event.target.value)}
                                  placeholder={marketTypeOption?.label || 'Example: 1H Moneyline'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Short name</Label>
                                <Input
                                  value={market.shortName}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'shortName', event.target.value)}
                                  placeholder={marketTypeOption?.label || 'Example: 1H ML'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Slug override (optional)</Label>
                                <Input
                                  value={market.slug}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'slug', event.target.value)}
                                  placeholder="Leave blank to generate automatically"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Outcome 1</Label>
                                <Input
                                  value={market.outcomeOne}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeOne', event.target.value)}
                                  placeholder={defaultOutcomes?.[0] || 'Example: Over'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Outcome 2</Label>
                                <Input
                                  value={market.outcomeTwo}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'outcomeTwo', event.target.value)}
                                  placeholder={defaultOutcomes?.[1] || 'Example: Under'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>
                                  Line
                                  {marketTypeOption?.requiresLine ? '' : ' (optional)'}
                                </Label>
                                <Input
                                  value={market.line}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'line', event.target.value)}
                                  placeholder={marketTypeOption?.requiresLine ? 'Example: 110.5 or -1.5' : 'Optional'}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Group title (optional)</Label>
                                <Input
                                  value={market.groupItemTitle}
                                  onChange={event => handleSportsCustomMarketChange(market.id, 'groupItemTitle', event.target.value)}
                                  placeholder="Defaults to the title sent to metadata"
                                />
                              </div>

                              {sportsForm.section === 'games' && (
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Icon</Label>
                                  <Select
                                    value={market.iconAssetKey || undefined}
                                    onValueChange={value => handleSportsCustomMarketChange(market.id, 'iconAssetKey', value)}
                                  >
                                    <SelectTrigger className="w-full md:max-w-xs">
                                      <SelectValue placeholder="No team icon" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No team icon</SelectItem>
                                      <SelectItem value="home">
                                        {sportsForm.teams[0]?.name || 'Home team'}
                                        {' '}
                                        icon
                                      </SelectItem>
                                      <SelectItem value="away">
                                        {sportsForm.teams[1]?.name || 'Away team'}
                                        {' '}
                                        icon
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <Button type="button" variant="outline" onClick={addSportsCustomMarket}>
                          <PlusIcon className="mr-2 size-4" />
                          Add custom market
                        </Button>
                      </div>
                    )}

                    {sportsForm.section === 'props' && sportsForm.eventVariant !== 'custom' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Player props</p>
                          <p className="text-sm text-muted-foreground">
                            Each row becomes one generated market with Over and Under outcomes.
                          </p>
                        </div>

                        {sportsForm.props.map((prop, index) => (
                          <div key={prop.id} className="grid grid-cols-1 gap-4 rounded-md border p-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                              <div className="flex items-center justify-between gap-3">
                                <Label htmlFor={`sports-prop-player-${prop.id}`}>
                                  Prop
                                  {' '}
                                  {index + 1}
                                </Label>
                                <Button type="button" variant="outline" size="sm" onClick={() => removeSportsProp(prop.id)}>
                                  <Trash2Icon className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>
                              <Input
                                id={`sports-prop-player-${prop.id}`}
                                value={prop.playerName}
                                onChange={event => handleSportsPropChange(prop.id, 'playerName', event.target.value)}
                                placeholder="Example: Jamal Murray"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Stat type</Label>
                              <Select
                                value={prop.statType || undefined}
                                onValueChange={value => handleSportsPropChange(prop.id, 'statType', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select stat type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="points">Points</SelectItem>
                                  <SelectItem value="rebounds">Rebounds</SelectItem>
                                  <SelectItem value="assists">Assists</SelectItem>
                                  <SelectItem value="receiving_yards">Receiving Yards</SelectItem>
                                  <SelectItem value="rushing_yards">Rushing Yards</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Line</Label>
                              <Input
                                value={prop.line}
                                onChange={event => handleSportsPropChange(prop.id, 'line', event.target.value)}
                                placeholder="Example: 29.5"
                              />
                            </div>

                          </div>
                        ))}

                        <Button type="button" variant="outline" onClick={addSportsProp}>
                          <PlusIcon className="mr-2 size-4" />
                          Add prop
                        </Button>
                      </div>
                    )}
                  </>
                )
              : (
                  <>
                    <div className="space-y-3">
                      <Label>Select Event type</Label>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'binary'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'binary'}
                            onChange={() => handleFieldChange('marketMode', 'binary')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'binary' ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                            )}
                            >
                              {form.marketMode === 'binary' && <span className="size-1.5 rounded-full bg-background" />}
                            </span>
                            Binary market
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Will BTC close above $110k on Mar 31, 2028?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Yes</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>No</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>

                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'multi_multiple'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'multi_multiple'}
                            onChange={() => handleFieldChange('marketMode', 'multi_multiple')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'multi_multiple'
                                ? 'border-primary bg-primary'
                                : `border-muted-foreground/50`,
                            )}
                            >
                              {form.marketMode === 'multi_multiple' && (
                                <span className="size-1.5 rounded-full bg-background" />
                              )}
                            </span>
                            Multi-market (multiple true outcomes)
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Which BTC milestones will be reached by Dec 31, 2028?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $100k (short: 100k)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $110k (short: 110k)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>BTC above $120k (short: 120k)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>

                        <label
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition',
                            form.marketMode === 'multi_unique'
                              ? 'border-primary bg-primary/5 text-primary'
                              : `hover:border-primary/40`,
                          )}
                        >
                          <input
                            type="radio"
                            name="market-mode"
                            className="sr-only"
                            checked={form.marketMode === 'multi_unique'}
                            onChange={() => handleFieldChange('marketMode', 'multi_unique')}
                          />
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className={cn(
                              'inline-flex size-4 items-center justify-center rounded-full border',
                              form.marketMode === 'multi_unique'
                                ? 'border-primary bg-primary'
                                : `border-muted-foreground/50`,
                            )}
                            >
                              {form.marketMode === 'multi_unique' && (
                                <span className="size-1.5 rounded-full bg-background" />
                              )}
                            </span>
                            Multi-market (single true outcome)
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Eg. Who will win the 2028 U.S. presidential election?
                          </p>
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Gavin Newsom (short: Newsom)</span>
                              <OutcomeStateDot value />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Nikki Haley (short: Haley)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1">
                              <span>Donald Trump (short: Trump)</span>
                              <OutcomeStateDot value={false} />
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {form.marketMode === 'binary' && (
                      <div className="space-y-4 rounded-md border p-4">
                        <div className="space-y-2">
                          <Label htmlFor="binary-question">Question</Label>
                          <Input
                            id="binary-question"
                            value={form.title}
                            disabled
                            readOnly
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Outcomes</Label>
                          <div className={cn(`
                            grid grid-cols-1 items-center gap-2
                            md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                          `)}
                          >
                            <Input
                              id="binary-outcome-yes"
                              value={form.binaryOutcomeYes}
                              onChange={event => handleFieldChange('binaryOutcomeYes', event.target.value)}
                              placeholder="Yes"
                              disabled={!isBinaryOutcomesEditable}
                            />
                            <Input
                              id="binary-outcome-no"
                              value={form.binaryOutcomeNo}
                              onChange={event => handleFieldChange('binaryOutcomeNo', event.target.value)}
                              placeholder="No"
                              disabled={!isBinaryOutcomesEditable}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-10 rounded-md"
                              onClick={() => setIsBinaryOutcomesEditable(previous => !previous)}
                              aria-label={isBinaryOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                            >
                              <SquarePenIcon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(form.marketMode === 'multi_multiple' || form.marketMode === 'multi_unique') && (
                      <div className="space-y-4 rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Each option creates one child market.</p>

                        <div className="space-y-4">
                          {form.options.map((option, index) => (
                            <div key={option.id} className="space-y-3 rounded-md border p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">
                                  Option
                                  {' '}
                                  {index + 1}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(option.id)}
                                  disabled={form.options.length <= 2}
                                >
                                  <Trash2Icon className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Market question</Label>
                                  <Input
                                    value={option.question}
                                    onChange={event => handleOptionChange(option.id, 'question', event.target.value)}
                                    placeholder={optionQuestionPlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Option name</Label>
                                  <Input
                                    value={option.title}
                                    onChange={event => handleOptionChange(option.id, 'title', event.target.value)}
                                    placeholder={optionNamePlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Short name</Label>
                                  <Input
                                    value={option.shortName}
                                    onChange={event => handleOptionChange(option.id, 'shortName', event.target.value)}
                                    placeholder={optionShortNamePlaceholder}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Slug</Label>
                                  <Input value={option.slug} readOnly />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Outcomes</Label>
                                  <div className={cn(`
                                    grid grid-cols-1 items-center gap-2
                                    md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]
                                  `)}
                                  >
                                    <Input
                                      value={option.outcomeYes}
                                      onChange={event => handleOptionChange(option.id, 'outcomeYes', event.target.value)}
                                      placeholder="Yes"
                                      disabled={!areMultiOutcomesEditable}
                                    />
                                    <Input
                                      value={option.outcomeNo}
                                      onChange={event => handleOptionChange(option.id, 'outcomeNo', event.target.value)}
                                      placeholder="No"
                                      disabled={!areMultiOutcomesEditable}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-10 rounded-md"
                                      onClick={() => setAreMultiOutcomesEditable(previous => !previous)}
                                      aria-label={areMultiOutcomesEditable ? 'Lock outcomes' : 'Edit outcomes'}
                                    >
                                      <SquarePenIcon className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label>Option image (optional)</Label>
                                <Input
                                  id={`option-image-${option.id}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={event => handleOptionImageUpload(option.id, event)}
                                  className="sr-only"
                                />
                                <label
                                  htmlFor={`option-image-${option.id}`}
                                  className={cn(`
                                    group relative flex size-28 cursor-pointer items-center justify-center
                                    overflow-hidden rounded-xl border border-dashed border-border bg-muted/20
                                    text-muted-foreground transition
                                    hover:border-primary/60
                                  `)}
                                >
                                  <span className={cn(`
                                    pointer-events-none absolute inset-0 bg-foreground/0 transition
                                    group-hover:bg-foreground/5
                                  `)}
                                  />
                                  {optionImagePreviewUrls[option.id]
                                    ? (
                                        <EventIconImage
                                          src={optionImagePreviewUrls[option.id]}
                                          alt={`Option ${index + 1} image preview`}
                                          sizes="256px"
                                          unoptimized
                                          containerClassName="size-full"
                                        />
                                      )
                                    : (
                                        <div className="text-xs text-muted-foreground">No image</div>
                                      )}
                                  <ImageUp
                                    className={cn(`
                                      pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2
                                      text-foreground/70 opacity-0 transition
                                      group-hover:opacity-100
                                    `)}
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button type="button" variant="outline" onClick={addOption}>
                          <PlusIcon className="mr-2 size-4" />
                          Add option
                        </Button>
                      </div>
                    )}
                  </>
                )}
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution-source-url">Resolution source URL (optional)</Label>
                <Input
                  id="resolution-source-url"
                  value={form.resolutionSource}
                  onChange={event => handleFieldChange('resolutionSource', event.target.value)}
                  placeholder="https://www.reuters.com/"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="resolution-rules">Resolution rules</Label>
                    {creationMode === 'recurring' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground transition hover:text-foreground">
                            <CircleHelpIcon className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-left">
                          <div className="grid gap-2">
                            <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                            {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                              <p key={`rules-token-${item}`}>{item}</p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRulesGeneratorDialogOpen(true)}
                    disabled={isGeneratingRules}
                  >
                    {isGeneratingRules
                      ? <Loader2Icon className="mr-2 size-4 animate-spin" />
                      : <SparkleIcon className="mr-2 size-4" />}
                    Generate with AI
                  </Button>
                </div>
                <Textarea
                  id="resolution-rules"
                  value={form.resolutionRules}
                  onChange={event => handleFieldChange('resolutionRules', event.target.value)}
                  placeholder="Define official source, UTC cutoff, tie/cancellation handling, and fallback source."
                  className="min-h-36"
                />
                {creationMode === 'recurring' && recurringResolvedRules && recurringResolvedRules !== form.resolutionRules.trim() && (
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    Preview:
                    {' '}
                    {recurringResolvedRules}
                  </p>
                )}
                {creationMode === 'recurring' && recurringOccurrencePreviews.length > 1 && (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-foreground">Recurring preview samples</p>
                    <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                      {recurringOccurrencePreviews.map((preview, index) => (
                        <div key={`${preview.slug}-${index}`} className="space-y-1">
                          <p className="font-medium text-foreground">{index === 0 ? 'First occurrence' : 'Next occurrence'}</p>
                          <p>
                            <span className="font-medium text-foreground">Title:</span>
                            {' '}
                            {preview.title}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Slug:</span>
                            {' '}
                            {preview.slug}
                          </p>
                          <p className="whitespace-pre-wrap">
                            <span className="font-medium text-foreground">Rules:</span>
                            {' '}
                            {preview.resolutionRules}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {creationMode === 'recurring' && recurringEditorialWarnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Recurring warnings</p>
                    <div className="mt-2 space-y-1">
                      {recurringEditorialWarnings.map(warning => (
                        <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={creatorWalletDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isAddingCreatorWallet) {
            setCreatorWalletDialogOpen(nextOpen)
            if (!nextOpen) {
              setCreatorWalletName('')
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this wallet</DialogTitle>
            <DialogDescription>
              Add a display name so this wallet can be recognized in mirrored market sources.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="creator-wallet-name">Wallet name</Label>
            <Input
              id="creator-wallet-name"
              value={creatorWalletName}
              onChange={event => setCreatorWalletName(event.target.value)}
              maxLength={80}
              placeholder="My creator wallet"
              disabled={isAddingCreatorWallet}
            />
            <p className="text-xs text-muted-foreground">
              {eoaAddress ?? 'Wallet not connected'}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreatorWalletDialogOpen(false)
                setCreatorWalletName('')
              }}
              disabled={isAddingCreatorWallet}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void addCurrentWalletToAllowedCreators()}
              disabled={isAddingCreatorWallet || !creatorWalletName.trim() || !eoaAddress}
            >
              {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Add wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminProposersDialog
        open={proposersDialogOpen}
        onOpenChange={setProposersDialogOpen}
        initialCreatorAddress={selectedCreatorAddress}
        lockCreatorSelection
        onStatusChange={(nextStatus) => {
          if (!selectedCreatorAddress || nextStatus.creator.toLowerCase() !== selectedCreatorAddress.toLowerCase()) {
            return
          }
          setProposerWhitelistCheckState(nextStatus.whitelistAddress ? 'ok' : 'missing')
        }}
      />

      <Dialog open={recurringRequiresServerWalletSetup} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={event => event.preventDefault()}
          onInteractOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Server Wallet Required</DialogTitle>
            <DialogDescription>
              Recurring events require adding the creator wallet private key to
              {' '}
              <code>EVENT_CREATION_SIGNER_PRIVATE_KEYS</code>
              {' '}
              in Vercel Environment Variables or your project&apos;s
              {' '}
              <code>.env</code>
              {' '}
              before you can create or edit recurring drafts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <AppLink href="/admin/events/calendar">
                <ArrowLeftIcon className="size-4" />
                Back to calendar
              </AppLink>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesGeneratorDialogOpen} onOpenChange={setRulesGeneratorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate rules with AI</DialogTitle>
            <DialogDescription>
              Experimental output generated by your configured AI provider.
              We recommend paid models (for example xAI or Manus with internet access) for better quality.
              Validate all text manually, including dates and links. You are responsible for the final rules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRulesGeneratorDialogOpen(false)}
              disabled={isGeneratingRules}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void generateRulesWithAi()} disabled={isGeneratingRules}>
              {isGeneratingRules && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFormDialogOpen} onOpenChange={setResetFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear form?</DialogTitle>
            <DialogDescription>
              This will remove all filled fields, uploaded images, and pre-sign checks from the wizard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetFormDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmResetForm}>
              Clear form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finalPreviewDialogOpen} onOpenChange={setFinalPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Event preview</DialogTitle>
            <DialogDescription>
              Review how your event and markets will look before starting signatures.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b px-6 py-3">
              <div className={cn(`
                mx-auto w-full max-w-2xl rounded-md border bg-muted/20 px-3 py-2 text-center font-mono text-xs
                text-muted-foreground
              `)}
              >
                {previewEventUrl}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 rounded-md border p-4">
                  <div className="relative size-22 overflow-hidden rounded-md border bg-muted">
                    {eventImagePreviewUrl
                      ? (
                          <EventIconImage
                            src={eventImagePreviewUrl}
                            alt="Event preview"
                            sizes="88px"
                            containerClassName="size-full"
                          />
                        )
                      : (
                          <Skeleton className="size-full rounded-none" />
                        )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-semibold text-foreground">{previewTitle}</p>
                    <p className="text-xs text-muted-foreground">{previewEndDate}</p>
                  </div>
                </div>

                {isMultiMarketPreview && previewMarkets.length > 0 && (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-semibold text-foreground">Outcomes</p>
                    <div className="space-y-3">
                      {previewMarkets.map((market, index) => (
                        <div key={market.key} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center gap-3">
                            {market.imageUrl && (
                              <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                                <EventIconImage
                                  src={market.imageUrl}
                                  alt={`Market ${index + 1} preview`}
                                  sizes="48px"
                                  containerClassName="size-full"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {market.title || `Market ${index + 1}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{market.question || 'Question pending'}</p>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                              <span className={cn(`
                                rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                                font-semibold text-emerald-600
                              `)}
                              >
                                {market.outcomeYes}
                              </span>
                              <span className={cn(`
                                rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                                text-red-500
                              `)}
                              >
                                {market.outcomeNo}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 sm:hidden">
                            <span className={cn(`
                              rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-sm
                              font-semibold text-emerald-600
                            `)}
                            >
                              {market.outcomeYes}
                            </span>
                            <span className={cn(`
                              rounded-md border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-sm font-semibold
                              text-red-500
                            `)}
                            >
                              {market.outcomeNo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-semibold text-foreground">Resolution rules</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {effectiveResolutionRules || 'Rules not set.'}
                  </p>
                  {form.resolutionSource
                    ? (
                        <a
                          href={form.resolutionSource}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {form.resolutionSource}
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No resolution source URL.</p>
                      )}
                </div>
              </div>

              <div className="border-t bg-muted/10 p-6 lg:border-t-0 lg:border-l">
                <p className="text-sm font-semibold text-foreground">Trade panel preview</p>
                <div className="mt-3 space-y-3 rounded-md border bg-background p-4">
                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">Buy</span>
                    <span className="text-muted-foreground">Sell</span>
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled
                      className={cn(`
                        rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold
                        text-emerald-600
                      `)}
                    >
                      {tradePreviewMarket?.outcomeYes || 'Yes'}
                    </button>
                    <button
                      type="button"
                      disabled
                      className={cn(`
                        rounded-md border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-500
                      `)}
                    >
                      {tradePreviewMarket?.outcomeNo || 'No'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Categories</p>
                  {selectedCategoryChips.length > 0
                    ? (
                        <div className={cn(`
                          flex scrollbar-none gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none]
                          [&::-webkit-scrollbar]:hidden
                        `)}
                        >
                          {selectedCategoryChips.map(item => (
                            <span
                              key={item.slug}
                              className={cn(`
                                shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground
                              `)}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )
                    : (
                        <p className="text-xs text-muted-foreground">No categories selected.</p>
                      )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalPreviewDialogOpen(false)}
              >
                Back to edit
              </Button>
              <Button type="button" onClick={continueFromFinalPreview}>
                Continue to sign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {currentStep === 4 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Create events and markets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-8">
            <div className="rounded-md border px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-foreground">
                    {t('Resolution mode')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resolutionType === 'dro_moov2'
                      ? t('Approved proposers can submit the final result directly.')
                      : t('Use UMA’s oracle and dispute process.')}
                  </p>
                </div>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border">
                  {(['dro_moov2', 'uma_moov2'] as const).map((mode) => {
                    const isUnavailable = mode === 'uma_moov2' && UMA_RESOLUTION_TEMPORARILY_DISABLED
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-disabled={isUnavailable}
                        className={cn(
                          'px-3 py-2 text-sm font-semibold transition-colors',
                          resolutionType === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:text-foreground',
                          isUnavailable && 'cursor-not-allowed opacity-60 hover:text-muted-foreground',
                        )}
                        onClick={() => handleResolutionTypeChange(mode)}
                      >
                        {mode === 'dro_moov2'
                          ? t('Direct')
                          : t('UMA')}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('funding', fundingHasIssue)}
                  disabled={fundingHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    fundingHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.funding
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">
                    EOA wallet balance (
                    {requiredTotalRewardUsdc.toFixed(2)}
                    {' '}
                    USDC required)
                  </p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(fundingCheckState)}
                />
              </div>
              {expandedPreSignChecks.funding && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {resolutionType === 'dro_moov2'
                      ? t('This direct fee is paid onchain to Kuest when the market request is created.')
                      : t('This reward pays the UMA proposer who resolves the question correctly.')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Need
                    {' '}
                    {requiredRewardUsdc.toFixed(2)}
                    {' '}
                    ×
                    {' '}
                    {marketCount}
                    {' '}
                    markets =
                    {' '}
                    {requiredTotalRewardUsdc.toFixed(2)}
                    {' '}
                    USDC. Balance:
                    {' '}
                    {eoaUsdcBalance.toFixed(2)}
                    {' '}
                    USDC.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {fundingCheckError && <p className="mt-2 text-sm text-destructive">{fundingCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('nativeGas', nativeGasHasIssue)}
                  disabled={nativeGasHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    nativeGasHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.nativeGas
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">
                    EOA wallet gas (
                    {requiredGasPol.toFixed(4)}
                    {' '}
                    POL estimated)
                  </p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(nativeGasCheckState)}
                />
              </div>
              {expandedPreSignChecks.nativeGas && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    This POL pays gas for market creation transactions (approve + initialize).
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Estimated need:
                    {' '}
                    {requiredGasPol.toFixed(4)}
                    {' '}
                    POL. Balance:
                    {' '}
                    {eoaPolBalance.toFixed(4)}
                    {' '}
                    POL.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {nativeGasCheckError && <p className="mt-2 text-sm text-destructive">{nativeGasCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('allowedCreator', allowedCreatorHasIssue)}
                  disabled={allowedCreatorHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    allowedCreatorHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.allowedCreator
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Wallet on allowed market creator wallets</p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(allowedCreatorCheckState)}
                />
              </div>
              {expandedPreSignChecks.allowedCreator && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Must be listed in "Allowed market creator wallets" in General settings so this wallet is recognized by the platform.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {eoaAddress ?? 'Wallet not connected'}
                    </p>
                    {eoaAddress && (
                      <button
                        type="button"
                        onClick={() => void copyWalletAddress()}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="Copy wallet address"
                      >
                        {isAddressCopied
                          ? <CheckIcon className="size-4 text-emerald-500" />
                          : (
                              <CopyIcon className="size-4" />
                            )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {allowedCreatorCheckState === 'missing' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7"
                  onClick={() => setCreatorWalletDialogOpen(true)}
                  disabled={isAddingCreatorWallet || !eoaAddress}
                >
                  {isAddingCreatorWallet && <Loader2Icon className="mr-2 size-3.5 animate-spin" />}
                  Add wallet
                </Button>
              )}
              {allowedCreatorCheckError && <p className="mt-2 text-sm text-destructive">{allowedCreatorCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('proposerWhitelist', proposerWhitelistHasIssue)}
                  disabled={proposerWhitelistHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    proposerWhitelistHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.proposerWhitelist
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">{t('Resolution proposers whitelist')}</p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(proposerWhitelistCheckState)}
                />
              </div>
              {expandedPreSignChecks.proposerWhitelist && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {proposerWhitelistCheckState === 'missing' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setProposersDialogOpen(true)}
                        disabled={!selectedCreatorAddress}
                      >
                        {t('Create whitelist')}
                      </Button>
                    )}
                    {proposerWhitelistCheckState === 'ok' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setProposersDialogOpen(true)}
                      >
                        <UserCheckIcon className="mr-2 size-3.5" />
                        {t('Manage proposers')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => void runProposerWhitelistCheck()}
                      disabled={proposerWhitelistCheckState === 'checking' || !selectedCreatorAddress}
                    >
                      {t('Re-check')}
                    </Button>
                  </div>
                </div>
              )}
              {proposerWhitelistCheckError && <p className="mt-2 text-sm text-destructive">{proposerWhitelistCheckError}</p>}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('slug', slugHasIssue)}
                  disabled={slugHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    slugHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.slug
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Slug available</p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(slugValidationState, 'unique')}
                />
              </div>
              {expandedPreSignChecks.slug && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">Final uniqueness check against your database.</p>
                  {creationMode === 'recurring' && recurringOccurrencePreviews.length > 0
                    ? (
                        <div className="space-y-1">
                          {recurringOccurrencePreviews.map((preview, index) => (
                            <p
                              key={`${preview.slug}-${index}`}
                              className="font-mono text-sm break-all text-muted-foreground"
                            >
                              {index === 0 ? 'First' : 'Next'}
                              :
                              {' '}
                              {preview.slug}
                            </p>
                          ))}
                        </div>
                      )
                    : (
                        <p className="font-mono text-sm break-all text-muted-foreground">
                          {form.slug || 'Slug not generated'}
                        </p>
                      )}
                </div>
              )}
              {slugValidationState === 'duplicate' && (
                <p className="mt-2 text-sm text-destructive">
                  {slugCheckError || 'Slug already exists in your database.'}
                </p>
              )}
              {slugCheckError && slugValidationState !== 'duplicate' && (
                <p className="mt-2 text-sm text-destructive">{slugCheckError}</p>
              )}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('openRouter', openRouterHasIssue)}
                  disabled={openRouterHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    openRouterHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.openRouter
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">OpenRouter active</p>
                </button>
                <CheckIndicator
                  state={getCheckIndicatorState(openRouterCheckState)}
                />
              </div>
              {expandedPreSignChecks.openRouter && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Required before running content AI checker.
                  </p>
                </div>
              )}
              {openRouterCheckError && <p className="mt-2 text-sm text-destructive">{openRouterCheckError}</p>}
              {openRouterCheckState !== 'ok' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7"
                  onClick={openAdminSettings}
                >
                  <ExternalLinkIcon className="mr-2 size-3.5" />
                  Open admin settings
                </Button>
              )}
            </div>

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => togglePreSignCheck('content', contentHasIssue)}
                  disabled={contentHasIssue}
                  className={cn(
                    'flex items-center gap-2 text-left',
                    contentHasIssue ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  {expandedPreSignChecks.content
                    ? <ChevronDownIcon className="size-5 text-muted-foreground" />
                    : (
                        <ChevronRightIcon className="size-5 text-muted-foreground" />
                      )}
                  <p className="text-xl font-semibold text-foreground">Content AI checker</p>
                </button>
                <CheckIndicator
                  state={contentIndicatorState}
                />
              </div>
              {expandedPreSignChecks.content && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Checks language, deterministic rules, required fields, and event-date consistency.
                  </p>
                  {contentCheckProgressLine && (
                    <p className="text-sm text-muted-foreground">{contentCheckProgressLine}</p>
                  )}
                  {openRouterCheckState !== 'ok' && (
                    <p className="text-sm text-muted-foreground">Waiting for OpenRouter check.</p>
                  )}
                  {contentCheckError && (
                    <p className="text-sm text-destructive">{contentCheckError}</p>
                  )}

                  {pendingAiIssues.length > 0 && (
                    <div className="space-y-2">
                      {pendingAiIssues.map(issue => (
                        <div key={getAiIssueKey(issue)} className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                          <p className="text-sm text-red-500">
                            {issue.reason}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => goToIssueStep(issue)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() => bypassIssue(issue)}
                            >
                              Ignore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {contentCheckWarnings.length > 0 && (
                    <div className="space-y-2">
                      {contentCheckWarnings.map(warning => (
                        <div
                          key={`warning-${getAiIssueKey(warning)}`}
                          className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2"
                        >
                          <p className="text-sm text-amber-700 dark:text-amber-400">
                            {warning.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        <Card className="bg-background">
          <CardHeader className="pt-8 pb-6">
            <CardTitle>Sign & create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-8">
            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">Progress</p>
                  <p className="text-sm text-muted-foreground">
                    {completedSignatureUnits}
                    {' '}
                    /
                    {' '}
                    {totalSignatureUnits}
                    {' '}
                    completed
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {signatureProgressPercent}
                  %
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${signatureProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-md border px-4 py-3">
              <p className="text-base font-semibold text-foreground">Execution plan</p>
              {preparedSignaturePlan
                ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        {getChainLabel()}
                        {' '}
                        ·
                        {' '}
                        {signatureTxs.length}
                        {' '}
                        txs
                        {' '}
                        ·
                        {' '}
                        {preparedSignaturePlan.creator}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        request:
                        {' '}
                        {preparedSignaturePlan.requestId}
                      </p>
                    </div>
                  )
                : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {pendingWorkflowRequestId
                          ? 'Server workflow is preparing your tx plan.'
                          : 'Sign auth to load tx plan.'}
                      </p>
                      {pendingWorkflowRequestId && (
                        <p className="font-mono text-xs text-muted-foreground">
                          request:
                          {' '}
                          {pendingWorkflowRequestId}
                        </p>
                      )}
                    </div>
                  )}
            </div>

            {signatureFlowError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
                <p className="text-sm text-red-500">{signatureFlowError}</p>
              </div>
            )}

            <div className="rounded-md border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Sign EIP-712 auth challenge</p>
                  <p className="text-xs text-muted-foreground">
                    {preparedSignaturePlan
                      ? authChallengeRemainingSeconds !== null
                        ? `Verified (auth time remaining: ${authChallengeCountdownLabel})`
                        : 'Verified'
                      : isSigningAuth
                        ? 'Awaiting wallet'
                        : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
                          ? 'Signed. Preparing tx plan on server'
                          : signatureFlowError
                            ? 'Failed'
                            : 'Pending'}
                  </p>
                  {authChallengeRemainingSeconds !== null && (
                    <p className={cn(
                      'text-xs',
                      authChallengeRemainingSeconds === 0 ? 'text-destructive' : 'text-red-500',
                    )}
                    >
                      {authChallengeRemainingSeconds === 0
                        ? 'Auth challenge expired. Click "Sign & prepare" to issue a new one.'
                        : preparedSignaturePlan
                          ? `Auth time remaining: ${authChallengeCountdownLabel}`
                          : `Auth challenge expires in ${authChallengeCountdownLabel}`}
                    </p>
                  )}
                </div>
                <SignatureTxIndicator
                  status={preparedSignaturePlan
                    ? 'success'
                    : isSigningAuth
                      ? 'awaiting_wallet'
                      : isPreparingSignaturePlan || pendingWorkflowStatus === 'prepare_running'
                        ? 'confirming'
                        : signatureFlowError
                          ? 'error'
                          : 'idle'}
                />
              </div>
            </div>

            {signatureTxs.length > 0 && (
              <div className="space-y-2">
                {signatureTxs.map((tx) => {
                  const explorerBase = preparedSignaturePlan ? getExplorerTxBase() : ''
                  const txHref = explorerBase && tx.hash ? `${explorerBase}${tx.hash}` : ''
                  const statusLabel = tx.status === 'idle'
                    ? 'Pending'
                    : tx.status === 'awaiting_wallet'
                      ? 'Awaiting wallet'
                      : tx.status === 'confirming'
                        ? 'Confirming'
                        : tx.status === 'success'
                          ? 'Confirmed'
                          : 'Failed'

                  return (
                    <div key={tx.id} className="rounded-md border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{statusLabel}</p>
                          {tx.hash && (
                            <p className="text-xs text-muted-foreground">
                              {txHref
                                ? (
                                    <a
                                      href={txHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 hover:text-foreground"
                                    >
                                      {tx.hash.slice(0, 10)}
                                      ...
                                      {tx.hash.slice(-8)}
                                      <ExternalLinkIcon className="size-3" />
                                    </a>
                                  )
                                : (
                                    <>
                                      {tx.hash.slice(0, 10)}
                                      ...
                                      {tx.hash.slice(-8)}
                                    </>
                                  )}
                            </p>
                          )}
                          {tx.error && <p className="text-xs text-red-500">{tx.error}</p>}
                        </div>
                        <SignatureTxIndicator status={tx.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {preparedSignaturePlan && (
              <div className="rounded-md border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Finalize and register markets</p>
                    <p className="text-xs text-muted-foreground">
                      {signatureFlowDone
                        ? 'Completed'
                        : finalizeInProgressAccepted
                          ? 'Accepted by server'
                          : finalizeStepIsRunning
                            ? 'Registering markets on server'
                            : finalizeStepHasError
                              ? 'Failed'
                              : 'Pending'}
                    </p>
                  </div>
                  <SignatureTxIndicator
                    status={finalizeStepSucceeded
                      ? 'success'
                      : finalizeStepIsRunning
                        ? 'confirming'
                        : finalizeStepHasError
                          ? 'error'
                          : 'idle'}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
