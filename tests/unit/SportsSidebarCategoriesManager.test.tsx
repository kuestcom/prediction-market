import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SportsSidebarCategoriesManager from '@/app/[locale]/admin/categories/_components/SportsSidebarCategoriesManager'

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getEsportsCategories: vi.fn(),
  updateCategories: vi.fn(),
  updateEsportsCategories: vi.fn(),
  toastSuccess: vi.fn(),
  useIsMobile: vi.fn(() => false),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string, variables?: Record<string, string>) => Object.entries(variables ?? {})
    .reduce((message, [key, replacement]) => message.replaceAll(`{${key}}`, replacement), value),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

vi.mock('@/app/[locale]/admin/categories/_actions/sports-sidebar-categories', () => ({
  getSportsSidebarCategoriesAction: (...args: unknown[]) => mocks.getCategories(...args),
  getEsportsSidebarCategoriesAction: (...args: unknown[]) => mocks.getEsportsCategories(...args),
  updateSportsSidebarCategoriesAction: (...args: unknown[]) => mocks.updateCategories(...args),
  updateEsportsSidebarCategoriesAction: (...args: unknown[]) => mocks.updateEsportsCategories(...args),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: {
    children: ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => open
    ? (
        <div data-testid="desktop-dialog">
          <button type="button" onClick={() => onOpenChange(false)}>Dismiss dialog</button>
          {children}
        </div>
      )
    : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: ReactNode, open: boolean }) => open
    ? <div data-testid="mobile-drawer">{children}</div>
    : null,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const initialCategories = [
  {
    id: 'world-cup',
    name: 'World Cup',
    slug: 'world-cup',
    enabled: true,
    featured: true,
    position: 0,
    nestedPosition: 0,
    parentId: 'soccer',
    canHaveChildren: false,
  },
  {
    id: 'soccer',
    name: 'Soccer',
    slug: 'soccer',
    enabled: true,
    featured: false,
    position: 0,
    nestedPosition: 0,
    parentId: null,
    canHaveChildren: true,
  },
  {
    id: 'premier-league',
    name: 'Premier League',
    slug: 'epl',
    enabled: true,
    featured: false,
    position: 0,
    nestedPosition: 1,
    parentId: 'soccer',
    canHaveChildren: false,
  },
  {
    id: 'mls',
    name: 'MLS',
    slug: 'mls',
    enabled: true,
    featured: false,
    position: 0,
    nestedPosition: 2,
    parentId: 'soccer',
    canHaveChildren: false,
  },
]

function renderManager(onOpenChange = vi.fn(), vertical: 'sports' | 'esports' = 'sports') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SportsSidebarCategoriesManager vertical={vertical} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
}

describe('sportsSidebarCategoriesManager', () => {
  beforeEach(() => {
    mocks.getCategories.mockReset()
    mocks.getEsportsCategories.mockReset()
    mocks.updateCategories.mockReset()
    mocks.updateEsportsCategories.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.useIsMobile.mockReset()
    mocks.useIsMobile.mockReturnValue(false)
    mocks.getCategories.mockResolvedValue({ success: true, data: initialCategories })
    mocks.getEsportsCategories.mockResolvedValue({ success: true, data: [] })
    mocks.updateCategories.mockResolvedValue({ success: true, data: initialCategories })
    mocks.updateEsportsCategories.mockResolvedValue({ success: true, data: [] })
  })

  it('lets admins enable, create, configure, feature, and sort categories before saving', async () => {
    const user = userEvent.setup()
    renderManager()

    const soccerNameInput = await screen.findByDisplayValue('Soccer')
    const soccerRow = soccerNameInput.closest('li')
    const worldCupRow = screen.getByDisplayValue('World Cup').closest('li')
    const mlsRow = screen.getByDisplayValue('MLS').closest('li')
    expect(soccerRow).not.toBeNull()
    expect(worldCupRow).not.toBeNull()
    expect(mlsRow).not.toBeNull()
    expect(screen.getByText('Nested leagues')).toBeInTheDocument()

    await user.click(within(worldCupRow!).getByRole('switch', { name: 'Enabled' }))
    await user.clear(within(soccerRow!).getByLabelText('Slug'))
    await user.type(within(soccerRow!).getByLabelText('Slug'), 'association-football')
    await user.click(within(soccerRow!).getByRole('switch', { name: 'Featured' }))
    await user.click(screen.getByRole('button', { name: 'Move Soccer up' }))
    await user.click(within(mlsRow!).getByRole('button', { name: 'Move MLS up' }))

    await user.type(screen.getByRole('textbox', { name: 'New category name' }), 'Cricket')
    expect(screen.getByRole('textbox', { name: 'New category slug' })).toHaveValue('cricket')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByDisplayValue('Cricket')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save sidebar' }))

    await waitFor(() => {
      expect(mocks.updateCategories).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateCategories).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        id: 'world-cup',
        enabled: false,
        featured: true,
        position: 1,
      }),
      expect.objectContaining({
        id: 'soccer',
        slug: 'association-football',
        featured: true,
        position: 0,
        nestedPosition: 0,
      }),
      expect.objectContaining({
        id: 'mls',
        nestedPosition: 1,
      }),
      expect.objectContaining({
        id: null,
        name: 'Cricket',
        slug: 'cricket',
        enabled: true,
        nestedPosition: 1,
        parentId: null,
      }),
    ]))
  })

  it('creates a league under a selected top-level link sport', async () => {
    const user = userEvent.setup()
    mocks.getCategories.mockResolvedValue({
      success: true,
      data: [
        ...initialCategories,
        {
          id: 'golf',
          name: 'Golf',
          slug: 'golf',
          enabled: true,
          featured: false,
          position: 1,
          nestedPosition: 1,
          parentId: null,
          canHaveChildren: true,
        },
      ],
    })
    renderManager()

    await screen.findByDisplayValue('Golf')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Parent sport' }), 'golf')
    await user.type(screen.getByRole('textbox', { name: 'New category name' }), 'PGA Tour')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByDisplayValue('PGA Tour')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save sidebar' }))

    await waitFor(() => {
      expect(mocks.updateCategories).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: null,
          name: 'PGA Tour',
          slug: 'pga-tour',
          nestedPosition: 0,
          parentId: 'golf',
        }),
      ]))
    })
  })

  it('preserves a manually edited slug when the new category name changes', async () => {
    const user = userEvent.setup()
    renderManager()

    const nameInput = await screen.findByRole('textbox', { name: 'New category name' })
    const slugInput = screen.getByRole('textbox', { name: 'New category slug' })
    await user.type(nameInput, 'Cricket')
    expect(slugInput).toHaveValue('cricket')

    await user.clear(slugInput)
    await user.type(slugInput, 'custom-cricket-url')
    await user.clear(nameInput)
    await user.type(nameInput, 'International Cricket')

    expect(slugInput).toHaveValue('custom-cricket-url')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Save sidebar' }))

    await waitFor(() => {
      expect(mocks.updateCategories).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: null,
          name: 'International Cricket',
          slug: 'custom-cricket-url',
        }),
      ]))
    })
  })

  it('ignores passive dismissal while saving and closes after the update finishes', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    let resolveUpdate!: (value: { success: true, data: typeof initialCategories }) => void
    const pendingUpdate = new Promise<{ success: true, data: typeof initialCategories }>((resolve) => {
      resolveUpdate = resolve
    })
    mocks.updateCategories.mockReturnValue(pendingUpdate)
    renderManager(onOpenChange)

    const soccerNameInput = await screen.findByDisplayValue('Soccer')
    await user.type(soccerNameInput, ' updated')
    await user.click(screen.getByRole('button', { name: 'Save sidebar' }))
    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Dismiss dialog' }))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Soccer updated')).toBeDisabled()

    await act(async () => {
      resolveUpdate({ success: true, data: initialCategories })
      await pendingUpdate
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledOnce())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('lists every top-level sport as a possible parent', async () => {
    mocks.getCategories.mockResolvedValue({
      success: true,
      data: Array.from({ length: 15 }, (_, index) => ({
        id: `sport-${index + 1}`,
        name: `Sport ${index + 1}`,
        slug: `sport-${index + 1}`,
        enabled: true,
        featured: false,
        position: index,
        nestedPosition: index,
        parentId: null,
        canHaveChildren: true,
      })),
    })
    renderManager()

    const parentSelect = await screen.findByRole('combobox', { name: 'Parent sport' })
    expect(within(parentSelect).getAllByRole('option')).toHaveLength(16)
  })

  it('keeps the manager open when the parent picker loses focus inside it', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderManager(onOpenChange)

    const parentSelect = await screen.findByRole('combobox', { name: 'Parent sport' })
    expect(parentSelect.tagName).toBe('SELECT')
    await user.click(parentSelect)
    await user.click(screen.getByRole('textbox', { name: 'New category name' }))

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('uses a mobile drawer on small screens', async () => {
    mocks.useIsMobile.mockReturnValue(true)
    renderManager()

    expect(await screen.findByTestId('mobile-drawer')).toBeInTheDocument()
    expect(screen.queryByTestId('desktop-dialog')).not.toBeInTheDocument()
  })

  it('creates and saves a nested league under an esports game', async () => {
    const user = userEvent.setup()
    const esportsCategories = [
      {
        id: 'group-esports-league-of-legends',
        name: 'LoL',
        slug: 'league-of-legends',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: null,
        canHaveChildren: true,
      },
      {
        id: 'group-esports-league-of-legends-games',
        name: 'Games',
        slug: 'games',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: 'group-esports-league-of-legends',
        canHaveChildren: false,
      },
      {
        id: 'group-esports-cs2',
        name: 'CS2',
        slug: 'counter-strike',
        enabled: true,
        featured: false,
        position: 1,
        nestedPosition: 1,
        parentId: null,
        canHaveChildren: true,
      },
      {
        id: 'group-esports-cs2-games',
        name: 'Games',
        slug: 'games',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: 'group-esports-cs2',
        canHaveChildren: false,
      },
    ]
    mocks.getEsportsCategories.mockResolvedValue({ success: true, data: esportsCategories })
    mocks.updateEsportsCategories.mockResolvedValue({ success: true, data: esportsCategories })
    renderManager(vi.fn(), 'esports')

    expect(await screen.findByRole('heading', { name: 'Manage esports sidebar' })).toBeInTheDocument()
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Parent game' }),
      'group-esports-league-of-legends',
    )
    await user.type(screen.getByRole('textbox', { name: 'New game or league name' }), 'LCS')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Save sidebar' }))

    await waitFor(() => {
      expect(mocks.updateEsportsCategories).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: null,
          name: 'LCS',
          slug: 'lcs',
          parentId: 'group-esports-league-of-legends',
        }),
      ]))
    })
    expect(mocks.updateCategories).not.toHaveBeenCalled()
  })
})
