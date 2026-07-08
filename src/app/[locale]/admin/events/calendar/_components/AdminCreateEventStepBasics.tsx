import type { AdminCreateEventFormProps } from './admin-create-event-form-types'
import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import type { AdminSportsFormState } from '@/lib/admin-sports-create'
import type { EventCreationRecurrenceUnit } from '@/lib/event-creation'
import type { SportsSourceProvider } from '@/lib/sports-source/providers'
import { CircleHelpIcon, ImageIcon, ImageUp, Loader2Icon, SearchIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatSportsSourceProviderLabel } from '@/lib/sports-source/providers'
import { cn } from '@/lib/utils'
import {
  CUSTOM_SPORTS_SLUG_SELECT_VALUE,
  RECURRENCE_OPTIONS,
  TEMPLATE_TOKEN_EXAMPLES,
  TEMPLATE_TOKEN_HELP_TEXT,
} from './admin-create-event-form-constants'
import { formatEventScheduleLabel } from './admin-create-event-form-utils'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>
type EventCreationMode = NonNullable<AdminCreateEventFormProps['creationMode']>

export function AdminCreateEventStepBasics({
  state,
  creationMode,
  sportsSlugCatalog,
  sportsSourceProviderOptions,
  sportsSourceProviderSelectValue,
}: {
  state: AdminCreateEventFormState
  creationMode: EventCreationMode
  sportsSlugCatalog: AdminCreateEventFormProps['sportsSlugCatalog']
  sportsSourceProviderOptions: SportsSourceProvider[]
  sportsSourceProviderSelectValue: string
}) {
  const t = useExtracted()
  const {
    addCategory,
    addCategoryFromInput,
    applySportsMatchCandidate,
    automaticDeployAtDate,
    automaticWalletAddress,
    availableLeagueOptions,
    categoryQuery,
    clearSportsMatchCandidate,
    defaultSportsMatchQuery,
    effectiveRecurringSlugTemplate,
    eoaAddress,
    eoaShortAddress,
    eventEndDateInputRef,
    eventImagePreviewUrl,
    filteredCategorySuggestions,
    form,
    handleEndDateInputValueChange,
    handleEventImageUpload,
    handleFieldChange,
    handleLeagueSlugSelectChange,
    handleSportsFieldChange,
    handleSportsStartTimeInputValueChange,
    handleSportsTeamChange,
    handleSportsTeamLogoUpload,
    handleSportSlugSelectChange,
    hasRecurringDeployHistory,
    isCustomLeagueSlug,
    isCustomSportSlug,
    isLoadingSigners,
    isSearchingSportsMatches,
    isSportsEvent,
    leagueSlugSelectValue,
    mainCategories,
    nextRecurringDeployDate,
    nextRecurringResolutionDate,
    recurrenceInterval,
    recurrenceUnit,
    recurringResolvedSlug,
    recurringResolvedTitle,
    removeCategory,
    searchSportsMatches,
    selectedCategoryChips,
    selectedMainCategory,
    selectedSportsMatch,
    setAutomaticWalletAddress,
    setCategoryQuery,
    setRecurrenceInterval,
    setRecurrenceUnit,
    setSlugTemplate,
    setSportsMatchQuery,
    setTitleTemplate,
    signers,
    sportSlugSelectValue,
    sportsCustomCategoryChips,
    sportsDerivedContent,
    sportsForm,
    sportsMatchCandidates,
    sportsMatchError,
    sportsMatchQuery,
    sportsStartTimeInputRef,
    teamLogoPreviewUrls,
    titleTemplate,
  } = state

  return (
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
                        <button
                          type="button"
                          className="text-muted-foreground transition hover:text-foreground"
                          aria-label="Help for title template"
                        >
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
                        <button
                          type="button"
                          className="text-muted-foreground transition hover:text-foreground"
                          aria-label="Help for slug template"
                        >
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
                        <button
                          type="button"
                          className="text-muted-foreground transition hover:text-foreground"
                          aria-label="Help for resolution date"
                        >
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
                  <Label htmlFor="event-creator">Creator</Label>
                  <Select
                    value={creationMode === 'recurring'
                      ? (automaticWalletAddress || undefined)
                      : (automaticWalletAddress || (eoaAddress ? '__eoa__' : undefined))}
                    onValueChange={value => setAutomaticWalletAddress(value === '__eoa__' ? '' : value)}
                  >
                    <SelectTrigger id="event-creator" className="w-full min-w-0">
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
                    <Label htmlFor="recurrence-unit">Recurrence</Label>
                    <Select
                      value={recurrenceUnit || undefined}
                      onValueChange={value => setRecurrenceUnit(value as EventCreationRecurrenceUnit)}
                    >
                      <SelectTrigger id="recurrence-unit">
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
                                    flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3
                                    py-2 text-left text-sm transition
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
                                  group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden
                                  rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground
                                  transition
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
  )
}
