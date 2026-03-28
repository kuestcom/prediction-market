'use client'

import type { MainCategoryOrderRow } from '@/lib/db/queries/tag'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getMainCategoriesForOrderingAction,
  updateMainCategoriesDisplayOrderAction,
} from '@/app/[locale]/admin/categories/_actions/main-category-order'
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
import { InputError } from '@/components/ui/input-error'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/useIsMobile'

interface MainCategorySortDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const EMPTY_MAIN_CATEGORIES: MainCategoryOrderRow[] = []

async function fetchMainCategoriesForOrdering() {
  const result = await getMainCategoriesForOrderingAction()
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to load main categories')
  }

  return result.data ?? []
}

export default function MainCategorySortDialog({
  open,
  onOpenChange,
  onSaved,
}: MainCategorySortDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [orderedCategories, setOrderedCategories] = useState<MainCategoryOrderRow[]>([])
  const [sortError, setSortError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-main-categories-order'],
    queryFn: fetchMainCategoriesForOrdering,
    enabled: open,
    staleTime: 0,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  })
  const mainCategories = data ?? EMPTY_MAIN_CATEGORIES

  useEffect(() => {
    if (!open) {
      setSortError(null)
      setIsSaving(false)
      return
    }

    if (!data) {
      return
    }

    setOrderedCategories(data)
  }, [data, open])

  const hasChanges = useMemo(() => {
    if (mainCategories.length !== orderedCategories.length) {
      return false
    }

    return mainCategories.some((category, index) => category.id !== orderedCategories[index]?.id)
  }, [mainCategories, orderedCategories])

  const handleMoveCategory = useCallback((index: number, direction: 'up' | 'down') => {
    setOrderedCategories((currentCategories) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= currentCategories.length) {
        return currentCategories
      }

      const nextCategories = [...currentCategories]
      const currentCategory = nextCategories[index]
      nextCategories[index] = nextCategories[targetIndex]
      nextCategories[targetIndex] = currentCategory
      return nextCategories
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (orderedCategories.length === 0) {
      return
    }

    setIsSaving(true)
    setSortError(null)

    try {
      const result = await updateMainCategoriesDisplayOrderAction(
        orderedCategories.map(category => category.id),
      )

      if (!result.success) {
        setSortError(result.error ?? t('Failed to update main category order'))
        return
      }

      toast.success(t('Main category order updated.'))
      await queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-main-categories-order'] })
      onSaved()
      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to update main category order:', error)
      setSortError(t('Failed to update main category order'))
    }
    finally {
      setIsSaving(false)
    }
  }, [onOpenChange, onSaved, orderedCategories, queryClient, t])

  const errorMessage = error instanceof Error
    ? error.message
    : t('Failed to load main categories')

  const isSaveDisabled = isLoading
    || isSaving
    || Boolean(error)
    || orderedCategories.length === 0
    || !hasChanges

  const sorterBody = (
    <div className="space-y-4">
      {isLoading
        ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )
        : error
          ? (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void refetch()
                  }}
                >
                  {t('Try again')}
                </Button>
              </div>
            )
          : orderedCategories.length === 0
            ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t('No main categories available to sort.')}
                </div>
              )
            : (
                <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {orderedCategories.map((category, index) => (
                    <li key={category.id} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                      <div className="
                        flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold
                        text-foreground
                      "
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{category.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{category.slug}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          disabled={isSaving || index === 0}
                          onClick={() => handleMoveCategory(index, 'up')}
                        >
                          <ArrowUpIcon className="size-4" />
                          <span className="sr-only">
                            {t('Move {name} up', { name: category.name })}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          disabled={isSaving || index === orderedCategories.length - 1}
                          onClick={() => handleMoveCategory(index, 'down')}
                        >
                          <ArrowDownIcon className="size-4" />
                          <span className="sr-only">
                            {t('Move {name} down', { name: category.name })}
                          </span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

      {sortError && <InputError message={sortError} />}
    </div>
  )

  const dialogTitle = t('Sort main categories')
  const dialogDescription = t('Adjust the site order for main categories.')

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <DrawerHeader className="space-y-2 p-0 text-left">
              <DrawerTitle>{dialogTitle}</DrawerTitle>
              <DrawerDescription>{dialogDescription}</DrawerDescription>
            </DrawerHeader>
            {sorterBody}
            <DrawerFooter className="mt-2 p-0">
              <Button type="submit" disabled={isSaveDisabled}>
                {isSaving ? t('Saving...') : t('Save order')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          {sorterBody}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={isSaveDisabled}>
              {isSaving ? t('Saving...') : t('Save order')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
