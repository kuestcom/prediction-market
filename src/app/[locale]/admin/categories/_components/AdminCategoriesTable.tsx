'use client'

import type { AdminCategoryRow } from '@/app/[locale]/admin/categories/_hooks/useAdminCategories'
import type { NonDefaultLocale } from '@/i18n/locales'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { updateCategoryAction } from '@/app/[locale]/admin/categories/_actions/update-category'
import { updateCategoryTranslationsAction } from '@/app/[locale]/admin/categories/_actions/update-category-translations'
import { useAdminCategoryColumns } from '@/app/[locale]/admin/categories/_components/columns'
import MainCategorySortDialog from '@/app/[locale]/admin/categories/_components/MainCategorySortDialog'
import { useAdminCategoriesTable } from '@/app/[locale]/admin/categories/_hooks/useAdminCategories'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/useIsMobile'
import { LOCALE_LABELS, NON_DEFAULT_LOCALES } from '@/i18n/locales'

function useAdminCategoriesTableState() {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  const {
    categories,
    totalCount,
    isLoading,
    error,
    retry,
    search,
    handleSearchChange,
    sortBy,
    sortOrder,
    mainOnly,
    handleSortChange,
    handleMainOnlyChange,
    pageIndex,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminCategoriesTable()

  const [pendingMainId, setPendingMainId] = useState<number | null>(null)
  const [pendingHiddenId, setPendingHiddenId] = useState<number | null>(null)
  const [pendingHideEventsId, setPendingHideEventsId] = useState<number | null>(null)
  const [translationCategory, setTranslationCategory] = useState<AdminCategoryRow | null>(null)
  const [translationValues, setTranslationValues] = useState<Partial<Record<NonDefaultLocale, string>>>({})
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [isSavingTranslations, setIsSavingTranslations] = useState(false)
  const [eventNoteCategory, setEventNoteCategory] = useState<AdminCategoryRow | null>(null)
  const [eventNoteValue, setEventNoteValue] = useState('')
  const [eventNoteError, setEventNoteError] = useState<string | null>(null)
  const [isSavingEventNote, setIsSavingEventNote] = useState(false)
  const [isMainCategorySortOpen, setIsMainCategorySortOpen] = useState(false)

  const closeTranslationsDialog = useCallback(() => {
    setTranslationCategory(null)
    setTranslationValues({})
    setTranslationError(null)
    setIsSavingTranslations(false)
  }, [])

  const handleToggleMain = useCallback(async (category: AdminCategoryRow, checked: boolean) => {
    setPendingMainId(category.id)

    const result = await updateCategoryAction(category.id, {
      is_main_category: checked,
    })

    if (result.success) {
      toast.success(checked
        ? t('{name} is now shown as a main category.', { name: category.name })
        : t('{name} is no longer marked as main.', { name: category.name }))
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    }
    else {
      toast.error(result.error || t('Failed to update category'))
    }

    setPendingMainId(null)
  }, [queryClient, t])

  const handleToggleHidden = useCallback(async (category: AdminCategoryRow, checked: boolean) => {
    setPendingHiddenId(category.id)

    const result = await updateCategoryAction(category.id, {
      is_hidden: checked,
    })

    if (result.success) {
      toast.success(checked
        ? t('{name} is now hidden on the site.', { name: category.name })
        : t('{name} is now visible on the site.', { name: category.name }))
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    }
    else {
      toast.error(result.error || t('Failed to update category'))
    }

    setPendingHiddenId(null)
  }, [queryClient, t])

  const handleToggleHideEvents = useCallback(async (category: AdminCategoryRow, checked: boolean) => {
    setPendingHideEventsId(category.id)

    const result = await updateCategoryAction(category.id, {
      hide_events: checked,
    })

    if (result.success) {
      toast.success(checked
        ? t('Events with category "{name}" are now hidden on the site.', { name: category.name })
        : t('Events with category "{name}" are now visible on the site.', { name: category.name }))
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    }
    else {
      toast.error(result.error || t('Failed to update category'))
    }

    setPendingHideEventsId(null)
  }, [queryClient, t])

  const handleOpenTranslations = useCallback((category: AdminCategoryRow) => {
    setTranslationCategory(category)
    setTranslationError(null)
    setTranslationValues(
      NON_DEFAULT_LOCALES.reduce<Partial<Record<NonDefaultLocale, string>>>((acc, locale) => {
        acc[locale] = category.translations?.[locale] ?? ''
        return acc
      }, {}),
    )
  }, [])

  const closeEventNoteEditor = useCallback(() => {
    setEventNoteCategory(null)
    setEventNoteValue('')
    setEventNoteError(null)
    setIsSavingEventNote(false)
  }, [])

  const handleOpenEventNote = useCallback((category: AdminCategoryRow) => {
    setEventNoteCategory(category)
    setEventNoteValue(category.event_page_note ?? '')
    setEventNoteError(null)
    setIsSavingEventNote(false)
  }, [])

  const handleTranslationChange = useCallback((locale: NonDefaultLocale, value: string) => {
    setTranslationValues(prev => ({
      ...prev,
      [locale]: value,
    }))
  }, [])

  const handleSaveTranslations = useCallback(async () => {
    if (!translationCategory) {
      return
    }

    setIsSavingTranslations(true)
    setTranslationError(null)

    const result = await updateCategoryTranslationsAction(translationCategory.id, translationValues)
    if (result.success) {
      queryClient.setQueriesData<{ data: AdminCategoryRow[], totalCount: number }>(
        { queryKey: ['admin-categories'] },
        (previous) => {
          if (!previous) {
            return previous
          }

          return {
            ...previous,
            data: previous.data.map((category) => {
              if (category.id !== translationCategory.id) {
                return category
              }

              return {
                ...category,
                translations: result.data ?? {},
              }
            }),
          }
        },
      )

      toast.success(t('Translations updated for {name}.', { name: translationCategory.name }))
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      closeTranslationsDialog()
      return
    }

    setTranslationError(result.error ?? t('Failed to update category translations'))
    setIsSavingTranslations(false)
  }, [closeTranslationsDialog, queryClient, t, translationCategory, translationValues])

  const handleSaveEventNote = useCallback(async () => {
    if (!eventNoteCategory) {
      return
    }

    setIsSavingEventNote(true)
    setEventNoteError(null)

    const normalizedNote = eventNoteValue.trim()
    const result = await updateCategoryAction(eventNoteCategory.id, {
      event_page_note: normalizedNote.length > 0 ? normalizedNote : null,
    })

    if (result.success) {
      queryClient.setQueriesData<{ data: AdminCategoryRow[], totalCount: number }>(
        { queryKey: ['admin-categories'] },
        (previous) => {
          if (!previous) {
            return previous
          }

          return {
            ...previous,
            data: previous.data.map((category) => {
              if (category.id !== eventNoteCategory.id) {
                return category
              }

              return {
                ...category,
                event_page_note: result.data?.event_page_note ?? null,
              }
            }),
          }
        },
      )

      toast.success(`Event note updated for ${eventNoteCategory.name}.`)
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      closeEventNoteEditor()
      return
    }

    setEventNoteError(result.error ?? t('Failed to update category'))
    setIsSavingEventNote(false)
  }, [closeEventNoteEditor, eventNoteCategory, eventNoteValue, queryClient, t])

  const columns = useAdminCategoryColumns({
    onToggleMain: handleToggleMain,
    onToggleHidden: handleToggleHidden,
    onToggleHideEvents: handleToggleHideEvents,
    onOpenTranslations: handleOpenTranslations,
    onOpenEventPageNote: handleOpenEventNote,
    isUpdatingMain: id => pendingMainId === id,
    isUpdatingHidden: id => pendingHiddenId === id,
    isUpdatingHideEvents: id => pendingHideEventsId === id,
  })

  return {
    isMobile,
    categories,
    totalCount,
    isLoading,
    error,
    retry,
    search,
    handleSearchChange,
    sortBy,
    sortOrder,
    mainOnly,
    handleSortChange,
    handleMainOnlyChange,
    pageIndex,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    translationCategory,
    translationValues,
    translationError,
    isSavingTranslations,
    eventNoteCategory,
    eventNoteValue,
    setEventNoteValue,
    eventNoteError,
    isSavingEventNote,
    isMainCategorySortOpen,
    setIsMainCategorySortOpen,
    closeTranslationsDialog,
    handleOpenTranslations,
    handleTranslationChange,
    handleSaveTranslations,
    closeEventNoteEditor,
    handleSaveEventNote,
    columns,
  }
}

export default function AdminCategoriesTable() {
  const t = useExtracted()
  const {
    isMobile,
    categories,
    totalCount,
    isLoading,
    error,
    retry,
    search,
    handleSearchChange,
    sortBy,
    sortOrder,
    mainOnly,
    handleSortChange,
    handleMainOnlyChange,
    pageIndex,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    translationCategory,
    translationValues,
    translationError,
    isSavingTranslations,
    eventNoteCategory,
    eventNoteValue,
    setEventNoteValue,
    eventNoteError,
    isSavingEventNote,
    isMainCategorySortOpen,
    setIsMainCategorySortOpen,
    closeTranslationsDialog,
    handleTranslationChange,
    handleSaveTranslations,
    closeEventNoteEditor,
    handleSaveEventNote,
    columns,
  } = useAdminCategoriesTableState()

  function handleSortChangeWithTranslation(column: string | null, order: 'asc' | 'desc' | null) {
    if (column === null || order === null) {
      handleSortChange(null, null)
      return
    }

    const columnMapping: Record<string, 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_events_count'> = {
      name: 'name',
      active_events_count: 'active_events_count',
    }

    const dbFieldName = columnMapping[column] || column
    handleSortChange(dbFieldName, order)
  }

  const onlyMainControl = (
    <div className="flex items-center gap-2">
      <Switch
        id="admin-categories-main-only"
        checked={mainOnly}
        onCheckedChange={handleMainOnlyChange}
      />
      <Label htmlFor="admin-categories-main-only" className="text-sm font-normal text-muted-foreground">
        {t('Only main')}
      </Label>
    </div>
  )

  const sortMainCategoriesControl = mainOnly
    ? (
        <Button
          type="button"
          variant="outline"
          className="h-8"
          onClick={() => setIsMainCategorySortOpen(true)}
        >
          <ArrowUpDownIcon className="mr-2 size-4" />
          {t('Sort main categories')}
        </Button>
      )
    : null

  const eventNoteTitle = eventNoteCategory
    ? `Event note for ${eventNoteCategory.name}`
    : 'Event category note'
  const eventNoteDescription = 'Set text shown on event pages that match this category. Plain text only.'

  const eventNoteFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="event-note-content">Note text</Label>
        <Textarea
          id="event-note-content"
          value={eventNoteValue}
          onChange={event => setEventNoteValue(event.target.value)}
          disabled={isSavingEventNote}
          placeholder="Write the category note shown on matching event pages (plain text only)."
          className="min-h-36"
        />
      </div>
      {eventNoteError && <InputError message={eventNoteError} />}
    </div>
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={categories}
        totalCount={totalCount}
        searchPlaceholder={t('Search categories...')}
        enableSelection={false}
        enablePagination
        enableColumnVisibility={false}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        emptyMessage={t('No categories found')}
        emptyDescription={t('Once categories are synced they will appear here.')}
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChangeWithTranslation}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        toolbarLeftContent={onlyMainControl}
        toolbarRightContent={sortMainCategoriesControl}
      />

      <Dialog
        open={Boolean(translationCategory)}
        onOpenChange={(open) => {
          if (!open) {
            closeTranslationsDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveTranslations()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('Category translations')}</DialogTitle>
              <DialogDescription>
                {t('Update non-English labels for this category. English remains the value in the main category table.')}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="translation-en">{t('English (source)')}</Label>
                <Input
                  id="translation-en"
                  value={translationCategory?.name ?? ''}
                  readOnly
                  disabled
                />
              </div>

              {NON_DEFAULT_LOCALES.map((locale) => {
                const fieldId = `translation-${locale}`
                return (
                  <div key={locale} className="grid gap-2">
                    <Label htmlFor={fieldId}>{LOCALE_LABELS[locale]}</Label>
                    <Input
                      id={fieldId}
                      value={translationValues[locale] ?? ''}
                      onChange={event => handleTranslationChange(locale, event.target.value)}
                      placeholder={t('Translation for {locale}', { locale: LOCALE_LABELS[locale] })}
                      disabled={isSavingTranslations}
                    />
                  </div>
                )
              })}

              {translationError && <InputError message={translationError} />}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeTranslationsDialog}
                disabled={isSavingTranslations}
              >
                {t('Cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSavingTranslations}
              >
                {isSavingTranslations ? t('Saving...') : t('Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isMobile
        ? (
            <Drawer
              open={Boolean(eventNoteCategory)}
              onOpenChange={(open) => {
                if (!open) {
                  closeEventNoteEditor()
                }
              }}
            >
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSaveEventNote()
                  }}
                >
                  <DrawerHeader className="mt-4 space-y-2 p-0 text-left">
                    <DrawerTitle>{eventNoteTitle}</DrawerTitle>
                    <DrawerDescription>{eventNoteDescription}</DrawerDescription>
                  </DrawerHeader>
                  {eventNoteFormFields}
                  <DrawerFooter className="mt-2 p-0">
                    <Button type="submit" disabled={isSavingEventNote}>
                      {isSavingEventNote ? t('Saving...') : t('Save')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSavingEventNote}
                      onClick={closeEventNoteEditor}
                    >
                      {t('Cancel')}
                    </Button>
                  </DrawerFooter>
                </form>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog
              open={Boolean(eventNoteCategory)}
              onOpenChange={(open) => {
                if (!open) {
                  closeEventNoteEditor()
                }
              }}
            >
              <DialogContent className="sm:max-w-xl">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSaveEventNote()
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{eventNoteTitle}</DialogTitle>
                    <DialogDescription>{eventNoteDescription}</DialogDescription>
                  </DialogHeader>
                  {eventNoteFormFields}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEventNoteEditor}
                      disabled={isSavingEventNote}
                    >
                      {t('Cancel')}
                    </Button>
                    <Button type="submit" disabled={isSavingEventNote}>
                      {isSavingEventNote ? t('Saving...') : t('Save')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

      <MainCategorySortDialog
        open={isMainCategorySortOpen}
        onOpenChange={setIsMainCategorySortOpen}
        onSaved={() => handleSortChange('display_order', 'asc')}
      />
    </>
  )
}
