'use client'

import type { AdminEventRow } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { useQueryClient } from '@tanstack/react-query'
import { SettingsIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface AdminEventsTableProps {
  initialAutoDeployNewEventsEnabled: boolean
}

export default function AdminEventsTable({ initialAutoDeployNewEventsEnabled }: AdminEventsTableProps) {
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
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminEventsTable()

  const [pendingHiddenId, setPendingHiddenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savedAutoDeployEnabled, setSavedAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [draftAutoDeployEnabled, setDraftAutoDeployEnabled] = useState(initialAutoDeployNewEventsEnabled)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const handleToggleHidden = useCallback(async (event: AdminEventRow, checked: boolean) => {
    setPendingHiddenId(event.id)

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

    setPendingHiddenId(null)
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

    setIsSavingSettings(false)
  }, [draftAutoDeployEnabled, t])

  const columns = useAdminEventsColumns({
    onToggleHidden: handleToggleHidden,
    isUpdatingHidden: eventId => pendingHiddenId === eventId,
  })

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button type="button" variant="outline" onClick={handleOpenSettings}>
          <SettingsIcon className="mr-2 size-4" />
          {t('Settings')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={events}
        totalCount={totalCount}
        searchPlaceholder={t('Search events...')}
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
      />

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
            <DialogDescription>
              {t('Control how newly synced events are published to the platform.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-1">
                <Label htmlFor="auto-deploy-events" className="text-sm font-medium">
                  {t('Auto-deploy new events')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('When disabled, new synced events stay hidden until manually enabled in this list.')}
                </p>
              </div>
              <Switch
                id="auto-deploy-events"
                checked={draftAutoDeployEnabled}
                onCheckedChange={setDraftAutoDeployEnabled}
                disabled={isSavingSettings}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSettings}
              disabled={isSavingSettings}
            >
              {t('Cancel')}
            </Button>
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
    </>
  )
}
