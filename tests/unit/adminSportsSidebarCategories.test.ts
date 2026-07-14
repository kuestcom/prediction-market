import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEsportsSidebarCategoriesAction,
  getSportsSidebarCategoriesAction,
  updateEsportsSidebarCategoriesAction,
  updateSportsSidebarCategoriesAction,
} from '@/app/[locale]/admin/categories/_actions/sports-sidebar-categories'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  txSet: vi.fn(),
  txWhere: vi.fn(),
  txValues: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
    transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
  updateTag: (...args: unknown[]) => mocks.updateTag(...args),
}))

function listQuery(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
  }
  query.from.mockReturnValue(query)
  query.where.mockReturnValue(query)
  return query
}

describe('admin sports sidebar category actions', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset()
    mocks.select.mockReset()
    mocks.transaction.mockReset()
    mocks.updateTag.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.txSet.mockReset()
    mocks.txWhere.mockReset()
    mocks.txValues.mockReset()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin', is_admin: true })
  })

  it('returns top-level categories and every direct nested league to admins', async () => {
    mocks.select.mockReturnValueOnce(listQuery([
      {
        id: 'soccer',
        item_type: 'group',
        label: 'Soccer',
        href: null,
        menu_slug: 'soccer',
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: null,
      },
      {
        id: 'world-cup',
        item_type: 'link',
        label: 'World Cup',
        href: '/sports/world-cup',
        menu_slug: 'world-cup',
        sort_order: 1,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: true,
        sidebar_sort_order: 0,
        parent_id: 'soccer',
      },
      {
        id: 'premier-league',
        item_type: 'link',
        label: 'Premier League',
        href: '/sports/epl/games',
        menu_slug: 'epl',
        sort_order: 2,
        enabled: true,
        sidebar_category: false,
        sidebar_enabled: false,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: 'soccer',
      },
    ]))

    await expect(getSportsSidebarCategoriesAction()).resolves.toMatchObject({
      success: true,
      data: [
        expect.objectContaining({ id: 'world-cup', featured: true }),
        expect.objectContaining({ id: 'soccer', featured: false, canHaveChildren: true }),
        expect.objectContaining({
          id: 'premier-league',
          parentId: 'soccer',
          nestedPosition: 2,
          canHaveChildren: false,
        }),
      ],
    })
  })

  it('updates existing rows, creates new rows, and invalidates the sports menu', async () => {
    mocks.select
      .mockReturnValueOnce(listQuery([
        {
          id: 'soccer',
          item_type: 'group',
          label: 'Soccer',
          href: null,
          menu_slug: 'soccer',
          sort_order: 0,
          enabled: true,
          sidebar_category: true,
          sidebar_enabled: true,
          sidebar_featured: false,
          sidebar_sort_order: 0,
          parent_id: null,
        },
        {
          id: 'premier-league',
          item_type: 'link',
          label: 'Premier League',
          href: '/sports/epl/games',
          menu_slug: 'epl',
          sort_order: 1,
          enabled: true,
          sidebar_category: false,
          sidebar_enabled: false,
          sidebar_featured: false,
          sidebar_sort_order: 0,
          parent_id: 'soccer',
        },
        {
          id: 'soccer-all',
          item_type: 'link',
          label: 'All',
          href: '/sports/soccer/games',
          menu_slug: 'soccer',
          sort_order: 0,
          enabled: true,
          sidebar_category: false,
          sidebar_enabled: true,
          sidebar_featured: false,
          sidebar_sort_order: 0,
          parent_id: 'soccer',
        },
      ]))
      .mockReturnValueOnce(listQuery([
        {
          id: 'soccer',
          item_type: 'group',
          label: 'Football',
          href: '/sports/football/games',
          menu_slug: 'football',
          sort_order: 0,
          enabled: true,
          sidebar_category: true,
          sidebar_enabled: false,
          sidebar_featured: true,
          sidebar_sort_order: 0,
          parent_id: null,
        },
        {
          id: 'premier-league',
          item_type: 'link',
          label: 'Premier League',
          href: '/sports/epl/games',
          menu_slug: 'epl',
          sort_order: 0,
          enabled: true,
          sidebar_category: true,
          sidebar_enabled: true,
          sidebar_featured: false,
          sidebar_sort_order: 0,
          parent_id: 'soccer',
        },
        {
          id: 'soccer-all',
          item_type: 'link',
          label: 'All',
          href: '/sports/soccer/games',
          menu_slug: 'soccer',
          sort_order: 0,
          enabled: true,
          sidebar_category: true,
          sidebar_enabled: true,
          sidebar_featured: false,
          sidebar_sort_order: 0,
          parent_id: 'soccer',
        },
      ]))

    const tx = {
      update: vi.fn(() => ({
        set: mocks.txSet.mockImplementation(() => ({
          where: mocks.txWhere.mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: mocks.txValues.mockResolvedValue([]),
      })),
    }
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx))

    const result = await updateSportsSidebarCategoriesAction([
      {
        id: 'soccer',
        name: 'Football',
        slug: 'football',
        enabled: false,
        featured: true,
        position: 0,
        nestedPosition: 0,
        parentId: null,
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
      },
      {
        id: 'soccer-all',
        name: 'All',
        slug: 'soccer',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: 'soccer',
      },
      {
        id: null,
        name: 'Volleyball',
        slug: 'volleyball',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: null,
      },
    ])

    expect(result.success).toBe(true)
    expect(mocks.txSet).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Football',
      href: '/sports/football/games',
      menu_slug: 'football',
      sidebar_enabled: false,
      sidebar_featured: true,
    }))
    expect(mocks.txSet).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Premier League',
      sort_order: 1,
      sidebar_category: true,
      sidebar_enabled: true,
    }))
    expect(mocks.txValues).toHaveBeenCalledWith(expect.objectContaining({
      item_type: 'link',
      label: 'Volleyball',
      href: '/sports/volleyball/games',
      sidebar_category: true,
      sidebar_enabled: true,
    }))
    expect(mocks.updateTag).toHaveBeenCalledWith('sports:menu')
  })

  it('creates a nested league under a top-level link sport and inherits its icon', async () => {
    const golfRow = {
      id: 'golf',
      item_type: 'link',
      label: 'Golf',
      href: '/sports/golf/props',
      icon_url: '/images/sports/menu/golf.svg',
      menu_slug: 'golf',
      sort_order: 0,
      enabled: true,
      sidebar_category: true,
      sidebar_enabled: true,
      sidebar_featured: false,
      sidebar_sort_order: 0,
      parent_id: null,
    }
    mocks.select
      .mockReturnValueOnce(listQuery([golfRow]))
      .mockReturnValueOnce(listQuery([
        golfRow,
        {
          ...golfRow,
          id: 'pga-tour',
          item_type: 'link',
          label: 'PGA Tour',
          href: '/sports/pga-tour/games',
          menu_slug: 'pga-tour',
          parent_id: 'golf',
        },
      ]))

    const tx = {
      update: vi.fn(() => ({
        set: mocks.txSet.mockImplementation(() => ({
          where: mocks.txWhere.mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: mocks.txValues.mockResolvedValue([]),
      })),
    }
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx))

    await expect(updateSportsSidebarCategoriesAction([
      {
        id: 'golf',
        name: 'Golf',
        slug: 'golf',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: null,
      },
      {
        id: null,
        name: 'PGA Tour',
        slug: 'pga-tour',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: 'golf',
      },
    ])).resolves.toMatchObject({ success: true })
    expect(mocks.txValues).toHaveBeenCalledWith(expect.objectContaining({
      label: 'PGA Tour',
      href: '/sports/pga-tour/games',
      icon_url: '/images/sports/menu/golf.svg',
      parent_id: 'golf',
      sort_order: 0,
    }))
  })

  it('allows a sport and its nested All link to share a slug', async () => {
    const rows = [
      {
        id: 'soccer',
        item_type: 'group',
        label: 'Soccer',
        href: '/sports/soccer/games',
        menu_slug: 'soccer',
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: null,
      },
      {
        id: 'soccer-all',
        item_type: 'link',
        label: 'All',
        href: '/sports/soccer/games',
        menu_slug: 'soccer',
        sort_order: 0,
        enabled: true,
        sidebar_category: false,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: 'soccer',
      },
    ]
    mocks.select
      .mockReturnValueOnce(listQuery(rows))
      .mockReturnValueOnce(listQuery(rows))

    const tx = {
      update: vi.fn(() => ({
        set: mocks.txSet.mockImplementation(() => ({
          where: mocks.txWhere.mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: mocks.txValues.mockResolvedValue([]),
      })),
    }
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx))

    await expect(updateSportsSidebarCategoriesAction([
      {
        id: 'soccer',
        name: 'Soccer',
        slug: 'soccer',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: null,
      },
      {
        id: 'soccer-all',
        name: 'All',
        slug: 'soccer',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: 'soccer',
      },
    ])).resolves.toMatchObject({ success: true })
  })

  it('returns only esports games and derives nested league slugs from their hrefs', async () => {
    mocks.select.mockReturnValueOnce(listQuery([
      {
        id: 'soccer',
        item_type: 'group',
        label: 'Soccer',
        href: '/sports/soccer/games',
        menu_slug: 'soccer',
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: null,
      },
      {
        id: 'group-esports-league-of-legends',
        item_type: 'group',
        label: 'LoL',
        href: null,
        menu_slug: 'league-of-legends',
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: null,
      },
      {
        id: 'group-esports-league-of-legends-asia-masters',
        item_type: 'link',
        label: 'Asia Masters',
        href: '/esports/league-of-legends/asia-masters',
        menu_slug: null,
        sort_order: 2,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: 'group-esports-league-of-legends',
      },
    ]))

    await expect(getEsportsSidebarCategoriesAction()).resolves.toMatchObject({
      success: true,
      data: [
        expect.objectContaining({
          id: 'group-esports-league-of-legends',
          slug: 'league-of-legends',
          canHaveChildren: true,
        }),
        expect.objectContaining({
          id: 'group-esports-league-of-legends-asia-masters',
          slug: 'asia-masters',
          parentId: 'group-esports-league-of-legends',
        }),
      ],
    })
  })

  it('renames an esports game path and creates a nested league with a parent-scoped slug', async () => {
    const rows = [
      {
        id: 'group-esports-league-of-legends',
        item_type: 'group',
        label: 'LoL',
        href: null,
        icon_url: '/images/lol.svg',
        menu_slug: 'league-of-legends',
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: null,
      },
      {
        id: 'group-esports-league-of-legends-games',
        item_type: 'link',
        label: 'Games',
        href: '/esports/league-of-legends/games',
        icon_url: '/images/lol.svg',
        menu_slug: null,
        sort_order: 0,
        enabled: true,
        sidebar_category: true,
        sidebar_enabled: true,
        sidebar_featured: false,
        sidebar_sort_order: 0,
        parent_id: 'group-esports-league-of-legends',
      },
    ]
    mocks.select
      .mockReturnValueOnce(listQuery(rows))
      .mockReturnValueOnce(listQuery(rows))

    const tx = {
      update: vi.fn(() => ({
        set: mocks.txSet.mockImplementation(() => ({
          where: mocks.txWhere.mockResolvedValue([]),
        })),
      })),
      insert: vi.fn(() => ({
        values: mocks.txValues.mockResolvedValue([]),
      })),
    }
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx))

    await expect(updateEsportsSidebarCategoriesAction([
      {
        id: 'group-esports-league-of-legends',
        name: 'League of Legends',
        slug: 'lol',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 0,
        parentId: null,
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
      },
      {
        id: null,
        name: 'LCS',
        slug: 'lcs',
        enabled: true,
        featured: false,
        position: 0,
        nestedPosition: 1,
        parentId: 'group-esports-league-of-legends',
      },
    ])).resolves.toMatchObject({ success: true })

    expect(mocks.txSet).toHaveBeenCalledWith(expect.objectContaining({
      label: 'League of Legends',
      href: '/esports/lol/games',
      menu_slug: 'lol',
    }))
    expect(mocks.txSet).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Games',
      href: '/esports/lol/games',
      menu_slug: null,
    }))
    expect(mocks.txValues).toHaveBeenCalledWith(expect.objectContaining({
      label: 'LCS',
      href: '/esports/lol/lcs',
      icon_url: '/images/lol.svg',
      parent_id: 'group-esports-league-of-legends',
      menu_slug: null,
    }))
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/esports', 'layout')
  })
})
