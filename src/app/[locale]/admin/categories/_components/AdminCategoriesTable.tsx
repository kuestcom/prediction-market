'use client'

import type { AdminCategoryRow } from '@/app/[locale]/admin/categories/_hooks/useAdminCategories'
import type { NonDefaultLocale } from '@/i18n/locales'
import { useQueryClient } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { updateCategoryAction } from '@/app/[locale]/admin/categories/_actions/update-category'
import { updateCategoryTranslationsAction } from '@/app/[locale]/admin/categories/_actions/update-category-translations'
import { useAdminCategoryColumns } from '@/app/[locale]/admin/categories/_components/columns'
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
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { LOCALE_LABELS, NON_DEFAULT_LOCALES } from '@/i18n/locales'

export default function AdminCategoriesTable() {
  const t = useExtracted()
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
    handleSortChange,
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

  const columns = useAdminCategoryColumns({
    onToggleMain: handleToggleMain,
    onToggleHidden: handleToggleHidden,
    onToggleHideEvents: handleToggleHideEvents,
    onOpenTranslations: handleOpenTranslations,
    isUpdatingMain: id => pendingMainId === id,
    isUpdatingHidden: id => pendingHiddenId === id,
    isUpdatingHideEvents: id => pendingHideEventsId === id,
  })

  function handleSortChangeWithTranslation(column: string | null, order: 'asc' | 'desc' | null) {
    if (column === null || order === null) {
      handleSortChange(null, null)
      return
    }

    const columnMapping: Record<string, 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_markets_count'> = {
      name: 'name',
      active_markets_count: 'active_markets_count',
    }

    const dbFieldName = columnMapping[column] || column
    handleSortChange(dbFieldName, order)
  }

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
    </>
  )
}
