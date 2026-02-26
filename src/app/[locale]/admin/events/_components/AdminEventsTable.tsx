'use client'

import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { useQueryClient } from '@tanstack/react-query'
import { FilterIcon, SearchIcon, SettingsIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { updateEventLivestreamUrlAction } from '@/app/[locale]/admin/events/_actions/update-event-livestream-url'
import { updateEventSyncSettingsAction } from '@/app/[locale]/admin/events/_actions/update-event-sync-settings'
import { updateEventVisibilityAction } from '@/app/[locale]/admin/events/_actions/update-event-visibility'
import { useAdminEventsColumns } from '@/app/[locale]/admin/events/_components/columns'
import { useAdminEventsTable } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'

interface AdminEventsTableProps {
  initialAutoDeployNewEventsEnabled: boolean
  mainCategoryOptions: { slug: string, name: string }[]
}

export default function AdminEventsTable({
  initialAutoDeployNewEventsEnabled,
  mainCategoryOptions,
}: AdminEventsTableProps) {
  const t = useExtracted()
  const queryClient = useQueryClient()

  const {
    events,
    totalCount,
    isLoading,
    error,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug,
    creator,
    creatorOptions,
    seriesSlug,
    seriesOptions,
    activeOnly,
    handleSearchChange,
    handleSortChange,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminEventsTable()

  const [pendingHiddenId, setPendingHiddenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savedAutoDeployEnabled, setSavedAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [draftAutoDeployEnabled, setDraftAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [livestreamEvent, setLivestreamEvent] = useState<AdminEventRow | null>(null)
  const [livestreamUrlValue, setLivestreamUrlValue] = useState('')
  const [livestreamError, setLivestreamError] = useState<string | null>(null)
  const [isSavingLivestream, setIsSavingLivestream] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftMainCategorySlug, setDraftMainCategorySlug] = useState(mainCategorySlug)
  const [draftCreator, setDraftCreator] = useState(creator)
  const [draftSeriesSlug, setDraftSeriesSlug] = useState(seriesSlug)

  const handleToggleHidden = useCallback(async (event: AdminEventRow, checked: boolean) => {
    setPendingHiddenId(event.id)

    try {
      const result = await updateEventVisibilityAction(event.id, checked)
      if (result.success) {
        toast.success(checked
          ? t('{name} is now hidden from public event lists.', { name: event.title })
          : t('{name} is now visible in public event lists.', { name: event.title }))
        void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      }
      else {
        toast.error(result.error || t('Failed to update event visibility'))
      }
    }
    catch (error) {
      console.error('Failed to update event visibility', error)
      toast.error(t('Failed to update event visibility'))
    }
    finally {
      setPendingHiddenId(null)
    }
  }, [queryClient, t])

  const handleOpenSettings = useCallback(() => {
    setDraftAutoDeployEnabled(savedAutoDeployEnabled)
    setSettingsOpen(true)
  }, [savedAutoDeployEnabled])

  const handleCloseSettings = useCallback(() => {
    if (isSavingSettings) {
      return
    }
    setDraftAutoDeployEnabled(savedAutoDeployEnabled)
    setSettingsOpen(false)
  }, [isSavingSettings, savedAutoDeployEnabled])

  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true)
    try {
      const result = await updateEventSyncSettingsAction(draftAutoDeployEnabled)
      if (result.success) {
        setSavedAutoDeployEnabled(draftAutoDeployEnabled)
        toast.success(draftAutoDeployEnabled
          ? t('New events will be auto-deployed.')
          : t('New events now require manual activation.'))
        setSettingsOpen(false)
      }
      else {
        toast.error(result.error || t('Failed to update event sync settings'))
      }
    }
    catch (error) {
      console.error('Failed to update event sync settings', error)
      toast.error(t('Failed to update event sync settings'))
    }
    finally {
      setIsSavingSettings(false)
    }
  }, [draftAutoDeployEnabled, t])

  const handleOpenFilters = useCallback(() => {
    setDraftMainCategorySlug(mainCategorySlug)
    setDraftCreator(creator)
    setDraftSeriesSlug(seriesSlug)
    setFiltersOpen(true)
  }, [mainCategorySlug, creator, seriesSlug])

  const handleApplyFilters = useCallback(() => {
    handleMainCategoryChange(draftMainCategorySlug)
    handleCreatorChange(draftCreator)
    handleSeriesSlugChange(draftSeriesSlug)
    setFiltersOpen(false)
  }, [
    draftMainCategorySlug,
    draftCreator,
    draftSeriesSlug,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
  ])

  const handleClearFilters = useCallback(() => {
    handleMainCategoryChange('all')
    handleCreatorChange('all')
    handleSeriesSlugChange('all')
    handleActiveOnlyChange(false)
  }, [handleMainCategoryChange, handleCreatorChange, handleSeriesSlugChange, handleActiveOnlyChange])

  const handleOpenLivestreamModal = useCallback((event: AdminEventRow) => {
    setLivestreamEvent(event)
    setLivestreamUrlValue(event.livestream_url ?? '')
    setLivestreamError(null)
  }, [])

  const handleCloseLivestreamModal = useCallback(() => {
    if (isSavingLivestream) {
      return
    }

    setLivestreamEvent(null)
    setLivestreamUrlValue('')
    setLivestreamError(null)
  }, [isSavingLivestream])

  const handleSaveLivestreamUrl = useCallback(async () => {
    if (!livestreamEvent) {
      return
    }

    setIsSavingLivestream(true)
    setLivestreamError(null)

    const result = await updateEventLivestreamUrlAction(livestreamEvent.id, livestreamUrlValue)
    if (result.success) {
      toast.success(livestreamUrlValue.trim()
        ? t('Livestream URL updated for {name}.', { name: livestreamEvent.title })
        : t('Livestream URL removed for {name}.', { name: livestreamEvent.title }))
      void queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      setLivestreamEvent(null)
      setLivestreamUrlValue('')
      setLivestreamError(null)
      setIsSavingLivestream(false)
      return
    }

    setLivestreamError(result.error ?? t('Failed to update livestream URL'))
    setIsSavingLivestream(false)
  }, [livestreamEvent, livestreamUrlValue, queryClient, t])

  const columns = useAdminEventsColumns({
    onToggleHidden: handleToggleHidden,
    onOpenLivestreamModal: handleOpenLivestreamModal,
    isUpdatingHidden: eventId => pendingHiddenId === eventId,
  })

  const settingsButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" onClick={handleOpenSettings} aria-label={t('Settings')}>
          <SettingsIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('Settings')}</TooltipContent>
    </Tooltip>
  )

  const createEventButton = (
    <Button asChild type="button" className="h-9">
      <Link href="/admin/create-event">{t('Create Event')}</Link>
    </Button>
  )

  const hasAppliedFilters = mainCategorySlug !== 'all'
    || creator !== 'all'
    || seriesSlug !== 'all'

  const filtersButton = (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={handleOpenFilters} aria-label={t('Filters')}>
            <FilterIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Filters')}</TooltipContent>
      </Tooltip>
      {hasAppliedFilters && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleClearFilters()
          }}
          className={`
            absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-background
            bg-foreground text-background
          `}
          aria-label={t('Clear filters')}
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </div>
  )

  const onlyActiveControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="admin-events-active-only"
        checked={activeOnly}
        onCheckedChange={handleActiveOnlyChange}
      />
      <Label htmlFor="admin-events-active-only" className="text-sm font-normal text-muted-foreground">
        {t('Only active')}
      </Label>
    </div>
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={events}
        totalCount={totalCount}
        searchPlaceholder={t('Search')}
        enableSelection={false}
        enablePagination
        enableColumnVisibility={false}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        emptyMessage={t('No events found')}
        emptyDescription={t('Events created from sync will show up here.')}
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        toolbarLeftContent={(
          <div className="flex items-center gap-3">
            {filtersButton}
            {onlyActiveControl}
          </div>
        )}
        toolbarRightContent={(
          <div className="flex items-center gap-2">
            {createEventButton}
            {settingsButton}
          </div>
        )}
        searchInputClassName="h-9 w-37.5 lg:w-62.5"
        searchLeadingIcon={<SearchIcon className="size-4" />}
      />

      <Dialog
        open={filtersOpen}
        onOpenChange={(open) => {
          if (open) {
            setFiltersOpen(true)
            return
          }
          setFiltersOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Filters')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('Main category')}</Label>
              <Select value={draftMainCategorySlug} onValueChange={setDraftMainCategorySlug}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={t('Main category')} />
                </SelectTrigger>
                <SelectContent align="start" className="py-1">
                  <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All categories')}</SelectItem>
                  {mainCategoryOptions.map(category => (
                    <SelectItem
                      key={category.slug}
                      value={category.slug}
                      className="mx-1 my-0.5 cursor-pointer rounded-md"
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {creatorOptions.length > 1 && (
              <div className="grid gap-2">
                <Label>{t('Creator')}</Label>
                <Select value={draftCreator} onValueChange={setDraftCreator}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={t('Creator')} />
                  </SelectTrigger>
                  <SelectContent align="start" className="py-1">
                    <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All creators')}</SelectItem>
                    {creatorOptions.map(creatorWallet => (
                      <SelectItem
                        key={creatorWallet}
                        value={creatorWallet}
                        className="mx-1 my-0.5 cursor-pointer rounded-md font-mono text-xs"
                      >
                        {creatorWallet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {seriesOptions.length > 0 && (
              <div className="grid gap-2">
                <Label>{t('Series')}</Label>
                <Select value={draftSeriesSlug} onValueChange={setDraftSeriesSlug}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={t('Series')} />
                  </SelectTrigger>
                  <SelectContent align="start" className="py-1">
                    <SelectItem value="all" className="mx-1 my-0.5 cursor-pointer rounded-md">{t('All series')}</SelectItem>
                    {seriesOptions.map(seriesOption => (
                      <SelectItem
                        key={seriesOption}
                        value={seriesOption}
                        className="mx-1 my-0.5 cursor-pointer rounded-md"
                      >
                        {seriesOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={handleApplyFilters}>
              {t('Apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          if (open) {
            setSettingsOpen(true)
            return
          }
          handleCloseSettings()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Events settings')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-deploy-events"
                  checked={draftAutoDeployEnabled}
                  onCheckedChange={setDraftAutoDeployEnabled}
                  disabled={isSavingSettings}
                />
                <Label htmlFor="auto-deploy-events" className="text-sm font-medium">
                  {t('Auto-deploy new events')}
                </Label>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">
                  {t('When disabled, new synced events stay hidden until manually enabled in this list.')}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                void handleSaveSettings()
              }}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(livestreamEvent)}
        onOpenChange={(open) => {
          if (open) {
            return
          }
          handleCloseLivestreamModal()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {livestreamEvent?.livestream_url ? t('Edit livestream URL') : t('Add livestream URL')}
            </DialogTitle>
            <DialogDescription>
              {t('Configure the livestream URL for this event. Leave empty to remove it.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="event-livestream-url">
                {t('Livestream URL')}
              </Label>
              <Input
                id="event-livestream-url"
                type="url"
                placeholder="https://example.com/live"
                value={livestreamUrlValue}
                onChange={event => setLivestreamUrlValue(event.target.value)}
                disabled={isSavingLivestream}
              />
              {livestreamEvent && (
                <p className="text-xs text-muted-foreground">
                  {livestreamEvent.title}
                </p>
              )}
            </div>
            {livestreamError && <InputError message={livestreamError} />}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseLivestreamModal}
              disabled={isSavingLivestream}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleSaveLivestreamUrl()
              }}
              disabled={isSavingLivestream}
            >
              {isSavingLivestream ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
