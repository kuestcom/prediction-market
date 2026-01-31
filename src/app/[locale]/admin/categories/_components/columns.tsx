import type { ColumnDef } from '@tanstack/react-table'
import type { AdminCategoryRow } from '@/app/[locale]/admin/categories/_hooks/useAdminCategories'
import { ArrowUpDownIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface CategoryColumnOptions {
  onToggleMain: (category: AdminCategoryRow, nextValue: boolean) => void
  onToggleHidden: (category: AdminCategoryRow, nextValue: boolean) => void
  onToggleHideEvents: (category: AdminCategoryRow, nextValue: boolean) => void
  isUpdatingMain: (categoryId: number) => boolean
  isUpdatingHidden: (categoryId: number) => boolean
  isUpdatingHideEvents: (categoryId: number) => boolean
}

export function createCategoryColumns({
  onToggleMain,
  onToggleHidden,
  onToggleHideEvents,
  isUpdatingMain,
  isUpdatingHidden,
  isUpdatingHideEvents,
}: CategoryColumnOptions): ColumnDef<AdminCategoryRow>[] {
  return [
    {
      accessorKey: 'name',
      id: 'name',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          Category
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const category = row.original
        return (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{category.name}</span>
              {category.is_hidden && (
                <Badge variant="outline" className="text-xs">
                  Hidden
                </Badge>
              )}
              {category.hide_events && (
                <Badge variant="destructive" className="text-xs">
                  Hide events
                </Badge>
              )}
              {category.is_main_category && (
                <Badge variant="secondary" className="text-xs">
                  Main
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              slug:
              {' '}
              {category.slug}
            </p>
            <p className="text-xs text-muted-foreground">
              {category.parent_name
                ? (
                    <>
                      Parent:
                      {' '}
                      {category.parent_name}
                    </>
                  )
                : (
                    <>No parent</>
                  )}
            </p>
          </div>
        )
      },
      enableHiding: false,
    },
    {
      accessorKey: 'active_markets_count',
      id: 'active_markets_count',
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          Active Markets
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          {row.original.active_markets_count}
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'is_main_category',
      id: 'is_main_category',
      header: () => (
        <div className="text-center text-xs font-medium text-muted-foreground uppercase">
          Main Category
        </div>
      ),
      cell: ({ row }) => {
        const category = row.original
        const disabled = isUpdatingMain(category.id)
        return (
          <div className="text-center">
            <Switch
              id={`main-${category.id}`}
              checked={category.is_main_category}
              disabled={disabled}
              onCheckedChange={checked => onToggleMain(category, checked)}
            />
            <span className="sr-only">
              Toggle main category for
              {' '}
              {category.name}
            </span>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'is_hidden',
      id: 'is_hidden',
      header: () => (
        <div className="text-center text-xs font-medium text-muted-foreground uppercase">
          Hide Category
        </div>
      ),
      cell: ({ row }) => {
        const category = row.original
        const disabled = isUpdatingHidden(category.id)
        return (
          <div className="text-center">
            <Switch
              id={`hide-${category.id}`}
              checked={category.is_hidden}
              disabled={disabled}
              onCheckedChange={checked => onToggleHidden(category, checked)}
            />
            <span className="sr-only">
              Toggle hide for
              {' '}
              {category.name}
            </span>
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'hide_events',
      id: 'hide_events',
      header: () => (
        <div className="text-center text-xs font-medium text-muted-foreground uppercase">
          Hide Events
        </div>
      ),
      cell: ({ row }) => {
        const category = row.original
        const disabled = isUpdatingHideEvents(category.id)
        return (
          <div className="text-center">
            <Switch
              id={`hide-${category.id}-events`}
              checked={category.hide_events}
              disabled={disabled}
              onCheckedChange={checked => onToggleHideEvents(category, checked)}
            />
            <span className="sr-only">
              Toggle hide for
              {' '}
              {category.name}
            </span>
          </div>
        )
      },
      enableSorting: false,
    },
  ]
}
