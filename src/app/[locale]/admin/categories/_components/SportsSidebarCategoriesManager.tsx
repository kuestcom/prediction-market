'use client'

import type {
  AdminSportsSidebarCategory,
  SportsSidebarCategoryInput,
} from '@/app/[locale]/admin/categories/_actions/sports-sidebar-categories'
import type { SportsVertical } from '@/lib/sports-vertical'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getEsportsSidebarCategoriesAction,
  getSportsSidebarCategoriesAction,
  updateEsportsSidebarCategoriesAction,
  updateSportsSidebarCategoriesAction,
} from '@/app/[locale]/admin/categories/_actions/sports-sidebar-categories'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

interface SportsSidebarCategoriesManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vertical?: SportsVertical
}

interface DraftSportsCategory extends SportsSidebarCategoryInput {
  clientKey: string
  canHaveChildren: boolean
}

const EMPTY_CATEGORIES: AdminSportsSidebarCategory[] = []
const TOP_LEVEL_PARENT_VALUE = 'top-level'

function toDraftCategory(category: AdminSportsSidebarCategory): DraftSportsCategory {
  return {
    ...category,
    clientKey: category.id,
  }
}

function compareSidebarPosition(a: DraftSportsCategory, b: DraftSportsCategory) {
  return a.position - b.position || a.name.localeCompare(b.name)
}

function compareNestedPosition(a: DraftSportsCategory, b: DraftSportsCategory) {
  return a.nestedPosition - b.nestedPosition || a.name.localeCompare(b.name)
}

function normalizePositions(categories: DraftSportsCategory[]) {
  const positionByKey = new Map<string, number>()
  const nestedPositionByKey = new Map<string, number>()

  categories
    .filter(category => category.featured)
    .toSorted(compareSidebarPosition)
    .forEach((category, position) => positionByKey.set(category.clientKey, position))
  categories
    .filter(category => !category.featured && !category.parentId)
    .toSorted(compareSidebarPosition)
    .forEach((category, position) => positionByKey.set(category.clientKey, position))

  const nestedByParent = new Map<string, DraftSportsCategory[]>()
  for (const category of categories) {
    if (!category.parentId) {
      continue
    }

    const nestedCategories = nestedByParent.get(category.parentId) ?? []
    nestedCategories.push(category)
    nestedByParent.set(category.parentId, nestedCategories)
  }
  for (const nestedCategories of nestedByParent.values()) {
    nestedCategories
      .toSorted(compareNestedPosition)
      .forEach((category, position) => nestedPositionByKey.set(category.clientKey, position))
  }

  return categories.map(category => ({
    ...category,
    position: positionByKey.get(category.clientKey) ?? category.position,
    nestedPosition: nestedPositionByKey.get(category.clientKey) ?? category.nestedPosition,
  }))
}

function slugifyCategoryName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCategorySlugInput(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
}

async function fetchSidebarCategories(vertical: SportsVertical): Promise<AdminSportsSidebarCategory[]> {
  const result = vertical === 'esports'
    ? await getEsportsSidebarCategoriesAction()
    : await getSportsSidebarCategoriesAction()
  if (!result.success) {
    throw new Error(result.error ?? `Failed to load ${vertical} sidebar categories`)
  }

  return result.data ?? EMPTY_CATEGORIES
}

function CategoryRow({
  category,
  disabled,
  index,
  parentName,
  sectionLength,
  vertical,
  onChange,
  onMove,
}: {
  category: DraftSportsCategory
  disabled: boolean
  index: number
  parentName: string | null
  sectionLength: number
  vertical: SportsVertical
  onChange: (changes: Partial<DraftSportsCategory>) => void
  onMove: (direction: 'up' | 'down') => void
}) {
  const t = useExtracted()
  const fieldPrefix = `${vertical}-sidebar-${category.clientKey}`

  return (
    <li className={cn('space-y-3 rounded-xl border bg-background p-3', !category.enabled && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {index + 1}
        </div>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldPrefix}-name`} className="text-xs text-muted-foreground">
              {t('Name')}
            </Label>
            <Input
              id={`${fieldPrefix}-name`}
              value={category.name}
              maxLength={80}
              disabled={disabled}
              onChange={event => onChange({ name: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldPrefix}-slug`} className="text-xs text-muted-foreground">
              {t('Slug')}
            </Label>
            <Input
              id={`${fieldPrefix}-slug`}
              value={category.slug}
              maxLength={80}
              spellCheck={false}
              disabled={disabled}
              onChange={event => onChange({ slug: normalizeCategorySlugInput(event.target.value) })}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={disabled || index === 0}
            onClick={() => onMove('up')}
          >
            <ArrowUpIcon className="size-4" />
            <span className="sr-only">{t('Move {name} up', { name: category.name })}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={disabled || index === sectionLength - 1}
            onClick={() => onMove('down')}
          >
            <ArrowDownIcon className="size-4" />
            <span className="sr-only">{t('Move {name} down', { name: category.name })}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-11">
        <div className="flex items-center gap-2">
          <Switch
            id={`${fieldPrefix}-enabled`}
            checked={category.enabled}
            disabled={disabled}
            onCheckedChange={(enabled: boolean) => onChange({ enabled })}
          />
          <Label htmlFor={`${fieldPrefix}-enabled`} className="text-sm font-normal">
            {t('Enabled')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`${fieldPrefix}-featured`}
            checked={category.featured}
            disabled={disabled}
            onCheckedChange={(featured: boolean) => onChange({ featured })}
          />
          <Label htmlFor={`${fieldPrefix}-featured`} className="text-sm font-normal">
            {t('Featured')}
          </Label>
        </div>
        {category.parentId && (
          <Badge variant="secondary">
            {vertical === 'esports'
              ? parentName
                ? t('Nested in {game}', { game: parentName })
                : t('Also nested in a game')
              : parentName
                ? t('Nested in {sport}', { sport: parentName })
                : t('Also nested in a sport')}
          </Badge>
        )}
      </div>
    </li>
  )
}

export default function SportsSidebarCategoriesManager({
  open,
  onOpenChange,
  vertical = 'sports',
}: SportsSidebarCategoriesManagerProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [draftOverride, setDraftOverride] = useState<DraftSportsCategory[] | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategorySlug, setNewCategorySlug] = useState('')
  const [isNewCategorySlugEdited, setIsNewCategorySlugEdited] = useState(false)
  const [newCategoryParentId, setNewCategoryParentId] = useState(TOP_LEVEL_PARENT_VALUE)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, isLoading, refetch } = useQuery<AdminSportsSidebarCategory[], Error>({
    queryKey: ['admin-sidebar-categories', vertical],
    queryFn: () => fetchSidebarCategories(vertical),
    enabled: open,
    staleTime: 0,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  })
  const fetchedCategories = data ?? EMPTY_CATEGORIES
  const fetchedDraftCategories: DraftSportsCategory[] = useMemo(
    () => fetchedCategories.map(toDraftCategory),
    [fetchedCategories],
  )
  const categories: DraftSportsCategory[] = draftOverride ?? fetchedDraftCategories
  const featuredCategories = useMemo(
    () => categories.filter(category => category.featured).toSorted(compareSidebarPosition),
    [categories],
  )
  const standardCategories = useMemo(
    () => categories
      .filter(category => !category.featured && !category.parentId)
      .toSorted(compareSidebarPosition),
    [categories],
  )
  const nestedLeagueParentOptions = useMemo(
    () => categories
      .filter(category => !category.parentId && category.canHaveChildren && category.id)
      .toSorted((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )
  const parentNameById = useMemo(() => {
    const parentNames = new Map<string, string>()
    for (const category of categories) {
      if (category.id && !category.parentId) {
        parentNames.set(category.id, category.name)
      }
    }
    return parentNames
  }, [categories])
  const nestedCategoryGroups = useMemo(() => {
    const categoriesByParent = new Map<string, DraftSportsCategory[]>()
    for (const category of categories) {
      if (!category.parentId || category.featured) {
        continue
      }

      const nestedCategories = categoriesByParent.get(category.parentId) ?? []
      nestedCategories.push(category)
      categoriesByParent.set(category.parentId, nestedCategories)
    }

    return Array.from(categoriesByParent, ([parentId, nestedCategories]) => ({
      parentId,
      parentName: parentNameById.get(parentId) ?? parentId,
      categories: nestedCategories.toSorted(compareNestedPosition),
    })).toSorted((a, b) => a.parentName.localeCompare(b.parentName))
  }, [categories, parentNameById])

  function updateDraftCategory(clientKey: string, changes: Partial<DraftSportsCategory>) {
    const currentCategory = categories.find(category => category.clientKey === clientKey)
    if (!currentCategory) {
      return
    }

    const isChangingFeatured = changes.featured !== undefined
      && changes.featured !== currentCategory.featured
    const updatedCategory = {
      ...currentCategory,
      ...changes,
      position: isChangingFeatured
        ? changes.featured
          ? featuredCategories.length
          : currentCategory.parentId
            ? currentCategory.position
            : standardCategories.length
        : currentCategory.position,
    }
    const updatedCategories = categories.map(category => category.clientKey === clientKey
      ? updatedCategory
      : category)
    setDraftOverride(changes.featured === undefined
      ? updatedCategories
      : normalizePositions(updatedCategories))
    setSaveError(null)
  }

  function moveDraftCategory(clientKey: string, direction: 'up' | 'down') {
    const category = categories.find(candidate => candidate.clientKey === clientKey)
    if (!category) {
      return
    }

    const section = category.featured
      ? categories.filter(candidate => candidate.featured).toSorted(compareSidebarPosition)
      : category.parentId
        ? categories
            .filter(candidate => !candidate.featured && candidate.parentId === category.parentId)
            .toSorted(compareNestedPosition)
        : categories
            .filter(candidate => !candidate.featured && !candidate.parentId)
            .toSorted(compareSidebarPosition)
    const currentIndex = section.findIndex(candidate => candidate.clientKey === clientKey)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= section.length) {
      return
    }

    const targetCategory = section[targetIndex]
    if (!targetCategory) {
      return
    }

    const positionKey = category.featured || !category.parentId ? 'position' : 'nestedPosition'
    const currentPosition = category[positionKey]
    const targetPosition = targetCategory[positionKey]
    setDraftOverride(normalizePositions(categories.map((candidate) => {
      if (candidate.clientKey === category.clientKey) {
        return { ...candidate, [positionKey]: targetPosition }
      }
      if (candidate.clientKey === targetCategory.clientKey) {
        return { ...candidate, [positionKey]: currentPosition }
      }
      return candidate
    })))
    setSaveError(null)
  }

  function handleAddCategory() {
    const name = newCategoryName.trim()
    const slug = slugifyCategoryName(newCategorySlug || name)
    const parentId = newCategoryParentId === TOP_LEVEL_PARENT_VALUE
      ? null
      : newCategoryParentId
    if (!name || !slug) {
      setSaveError(t('Enter a category name and slug.'))
      return
    }

    if (parentId && !nestedLeagueParentOptions.some(category => category.id === parentId)) {
      setSaveError(vertical === 'esports'
        ? t('Select a valid parent game for the nested league.')
        : t('Select a valid parent sport for the nested league.'))
      return
    }

    const hasDuplicateSlug = categories.some(category => category.slug === slug && (
      vertical === 'esports'
        ? category.parentId === parentId
        : category.id !== parentId
    ))
    if (hasDuplicateSlug) {
      setSaveError(vertical === 'esports'
        ? t('The slug "{slug}" is already used under this parent.', { slug })
        : t('The slug "{slug}" is already used in this sidebar.', { slug }))
      return
    }

    setDraftOverride(normalizePositions([
      ...categories,
      {
        id: null,
        clientKey: `new-${Date.now()}`,
        name,
        slug,
        enabled: true,
        featured: false,
        position: standardCategories.length,
        nestedPosition: categories.filter(category => category.parentId === parentId).length,
        parentId,
        canHaveChildren: false,
      },
    ]))
    setNewCategoryName('')
    setNewCategorySlug('')
    setIsNewCategorySlugEdited(false)
    setSaveError(null)
  }

  function closeManager() {
    setDraftOverride(null)
    setNewCategoryName('')
    setNewCategorySlug('')
    setIsNewCategorySlugEdited(false)
    setNewCategoryParentId(TOP_LEVEL_PARENT_VALUE)
    setSaveError(null)
    setIsSaving(false)
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (isSaving) {
        return
      }

      closeManager()
      return
    }

    onOpenChange(true)
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)

    const input: SportsSidebarCategoryInput[] = categories.map(category => ({
      id: category.id,
      name: category.name.trim(),
      slug: category.slug.trim(),
      enabled: category.enabled,
      featured: category.featured,
      position: category.position,
      nestedPosition: category.nestedPosition,
      parentId: category.parentId,
    }))
    const result = vertical === 'esports'
      ? await updateEsportsSidebarCategoriesAction(input)
      : await updateSportsSidebarCategoriesAction(input)

    if (!result.success) {
      setSaveError(result.error ?? (vertical === 'esports'
        ? t('Failed to update esports sidebar categories')
        : t('Failed to update sports sidebar categories')))
      setIsSaving(false)
      return
    }

    queryClient.setQueryData(['admin-sidebar-categories', vertical], result.data ?? EMPTY_CATEGORIES)
    toast.success(vertical === 'esports'
      ? t('Esports sidebar categories updated.')
      : t('Sports sidebar categories updated.'))
    closeManager()
  }

  function renderCategorySection(
    title: string,
    description: string,
    sectionCategories: DraftSportsCategory[],
  ) {
    return (
      <section className="space-y-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {title}
            <Badge variant="outline">{sectionCategories.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {sectionCategories.length === 0
          ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {t('No categories in this section.')}
              </div>
            )
          : (
              <ul className="space-y-2">
                {sectionCategories.map((category, index) => (
                  <CategoryRow
                    key={category.clientKey}
                    category={category}
                    disabled={isSaving}
                    index={index}
                    parentName={category.parentId ? parentNameById.get(category.parentId) ?? null : null}
                    sectionLength={sectionCategories.length}
                    vertical={vertical}
                    onChange={changes => updateDraftCategory(category.clientKey, changes)}
                    onMove={direction => moveDraftCategory(category.clientKey, direction)}
                  />
                ))}
              </ul>
            )}
      </section>
    )
  }

  const errorMessage = error instanceof Error
    ? error.message
    : vertical === 'esports'
      ? t('Failed to load esports sidebar categories')
      : t('Failed to load sports sidebar categories')
  const managerBody = (
    <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
      {isLoading
        ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )
        : error
          ? (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  {t('Try again')}
                </Button>
              </div>
            )
          : (
              <>
                <section className="space-y-3 rounded-xl border border-dashed p-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {vertical === 'esports'
                        ? t('Create esports game or nested league')
                        : t('Create sports category or nested league')}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {vertical === 'esports'
                        ? t('Choose a parent game to create a nested league. New entries link to /esports/game/slug.')
                        : t('Choose a parent sport to create a nested league. New entries link to /sports/slug/games.')}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input
                      value={newCategoryName}
                      placeholder={vertical === 'esports' ? t('Game or league name') : t('Category name')}
                      aria-label={vertical === 'esports' ? t('New game or league name') : t('New category name')}
                      disabled={isSaving}
                      onChange={(event) => {
                        const nextName = event.target.value
                        setNewCategoryName(nextName)
                        if (!isNewCategorySlugEdited) {
                          setNewCategorySlug(slugifyCategoryName(nextName))
                        }
                      }}
                    />
                    <Input
                      value={newCategorySlug}
                      placeholder={vertical === 'esports' ? t('game-or-league-slug') : t('category-slug')}
                      aria-label={vertical === 'esports' ? t('New game or league slug') : t('New category slug')}
                      spellCheck={false}
                      disabled={isSaving}
                      onChange={(event) => {
                        setNewCategorySlug(normalizeCategorySlugInput(event.target.value))
                        setIsNewCategorySlugEdited(true)
                      }}
                    />
                    <select
                      value={newCategoryParentId}
                      disabled={isSaving}
                      aria-label={vertical === 'esports' ? t('Parent game') : t('Parent sport')}
                      className={cn(`
                        h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none
                        focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
                        disabled:cursor-not-allowed disabled:opacity-50
                        dark:bg-input/30
                      `)}
                      onChange={(event) => {
                        setNewCategoryParentId(event.target.value)
                        setSaveError(null)
                      }}
                    >
                      <option value={TOP_LEVEL_PARENT_VALUE}>
                        {vertical === 'esports' ? t('Top-level game') : t('Top-level sport')}
                      </option>
                      {nestedLeagueParentOptions.map(category => (
                        <option key={category.id} value={category.id ?? TOP_LEVEL_PARENT_VALUE}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" disabled={isSaving} onClick={handleAddCategory}>
                      <PlusIcon className="mr-2 size-4" />
                      {t('Add')}
                    </Button>
                  </div>
                </section>

                {renderCategorySection(
                  t('Featured categories'),
                  vertical === 'esports'
                    ? t('Shown first at the top of the esports sidebar.')
                    : t('Shown first at the top of the sports sidebar.'),
                  featuredCategories,
                )}
                {renderCategorySection(
                  vertical === 'esports' ? t('All games') : t('All sports'),
                  vertical === 'esports'
                    ? t('Shown after featured categories. Nested leagues stay inside their game.')
                    : t('Shown after featured categories. Nested leagues stay inside their sport.'),
                  standardCategories,
                )}
                <section className="space-y-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      {t('Nested leagues')}
                      <Badge variant="outline">
                        {nestedCategoryGroups.reduce((total, group) => total + group.categories.length, 0)}
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {vertical === 'esports'
                        ? t('Manage every league shown inside its parent game.')
                        : t('Manage every league shown inside its parent sport.')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {nestedCategoryGroups.map(group => (
                      <details key={group.parentId} className="rounded-xl border bg-muted/20">
                        <summary className="
                          flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm
                          font-semibold
                        "
                        >
                          <span>{group.parentName}</span>
                          <Badge variant="outline">{group.categories.length}</Badge>
                        </summary>
                        <ul className="space-y-2 border-t p-3">
                          {group.categories.map((category, index) => (
                            <CategoryRow
                              key={category.clientKey}
                              category={category}
                              disabled={isSaving}
                              index={index}
                              parentName={group.parentName}
                              sectionLength={group.categories.length}
                              vertical={vertical}
                              onChange={changes => updateDraftCategory(category.clientKey, changes)}
                              onMove={direction => moveDraftCategory(category.clientKey, direction)}
                            />
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </section>
              </>
            )}

      {saveError && <InputError message={saveError} />}
    </div>
  )

  const title = vertical === 'esports' ? t('Manage esports sidebar') : t('Manage sports sidebar')
  const description = vertical === 'esports'
    ? t('Enable, disable, create, rename, feature, and reorder esports games and nested leagues.')
    : t('Enable, disable, create, rename, feature, and reorder sports categories and nested leagues.')
  const isSaveDisabled = isLoading || isSaving || Boolean(error) || categories.length === 0 || draftOverride === null
  const saveButton = (
    <Button type="submit" disabled={isSaveDisabled}>
      {isSaving ? t('Saving...') : t('Save sidebar')}
    </Button>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[95vh] w-full bg-background px-4 pt-4 pb-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <DrawerHeader className="space-y-2 p-0 text-left">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            {managerBody}
            <DrawerFooter className="p-0">
              {saveButton}
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => handleOpenChange(false)}>
                {t('Cancel')}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {managerBody}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => handleOpenChange(false)}>
              {t('Cancel')}
            </Button>
            {saveButton}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
