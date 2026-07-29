import type { AdminEventAttentionFilter } from '@/lib/admin-event-attention'

import { isAdminEventAttentionFilter } from '@/lib/admin-event-attention'

const ADMIN_EVENTS_SORT_FIELDS = [
  'title',
  'status',
  'volume',
  'volume_24h',
  'created_at',
  'updated_at',
  'end_date',
] as const

const ADMIN_EVENTS_PAGE_SIZES = [10, 25, 50, 100] as const

export type AdminEventsSortBy = (typeof ADMIN_EVENTS_SORT_FIELDS)[number]
type AdminEventsSortOrder = 'asc' | 'desc'

export interface AdminEventsTableState {
  pageIndex: number
  pageSize: number
  search: string
  sortBy: AdminEventsSortBy
  sortOrder: AdminEventsSortOrder
  mainCategorySlug: string
  creator: string
  seriesSlug: string
  activeOnly: boolean
  attention: AdminEventAttentionFilter | 'all'
}

export type AdminEventsTableStatePatch = Partial<AdminEventsTableState>

export const DEFAULT_ADMIN_EVENTS_TABLE_STATE: AdminEventsTableState = {
  pageIndex: 0,
  pageSize: 50,
  search: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
  mainCategorySlug: 'all',
  creator: 'all',
  seriesSlug: 'all',
  activeOnly: false,
  attention: 'all',
}

function resolveNonEmptyFilter(value: string | null) {
  return value?.trim() || 'all'
}

function resolveAttentionFilter(value: string | null): AdminEventAttentionFilter | 'all' {
  return isAdminEventAttentionFilter(value) ? value : 'all'
}

function resolveSortBy(value: string | null): AdminEventsSortBy {
  return ADMIN_EVENTS_SORT_FIELDS.includes(value as AdminEventsSortBy)
    ? (value as AdminEventsSortBy)
    : DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortBy
}

export function isAdminEventsSortBy(value: string): value is AdminEventsSortBy {
  return ADMIN_EVENTS_SORT_FIELDS.includes(value as AdminEventsSortBy)
}

function resolveSortOrder(value: string | null): AdminEventsSortOrder {
  return value === 'asc' || value === 'desc' ? value : DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortOrder
}

function resolvePageIndex(value: string | null) {
  const page = Number.parseInt(value ?? '', 10)
  return Number.isInteger(page) && page > 0 ? page - 1 : DEFAULT_ADMIN_EVENTS_TABLE_STATE.pageIndex
}

function resolvePageSize(value: string | null) {
  const pageSize = Number.parseInt(value ?? '', 10)
  return ADMIN_EVENTS_PAGE_SIZES.includes(pageSize as (typeof ADMIN_EVENTS_PAGE_SIZES)[number])
    ? pageSize
    : DEFAULT_ADMIN_EVENTS_TABLE_STATE.pageSize
}

export function parseAdminEventsTableState(searchParams: URLSearchParams): AdminEventsTableState {
  return {
    pageIndex: resolvePageIndex(searchParams.get('page')),
    pageSize: resolvePageSize(searchParams.get('pageSize')),
    search: searchParams.get('search') ?? DEFAULT_ADMIN_EVENTS_TABLE_STATE.search,
    sortBy: resolveSortBy(searchParams.get('sort')),
    sortOrder: resolveSortOrder(searchParams.get('order')),
    mainCategorySlug: resolveNonEmptyFilter(searchParams.get('category')),
    creator: resolveNonEmptyFilter(searchParams.get('creator')),
    seriesSlug: resolveNonEmptyFilter(searchParams.get('series')),
    activeOnly: searchParams.get('active') === '1',
    attention: resolveAttentionFilter(searchParams.get('attention')),
  }
}

function setOrDelete(searchParams: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (value === defaultValue) {
    searchParams.delete(key)
    return
  }

  searchParams.set(key, value)
}

export function updateAdminEventsSearchParams(searchParams: URLSearchParams, patch: AdminEventsTableStatePatch) {
  const state = {
    ...parseAdminEventsTableState(searchParams),
    ...patch,
  }
  const nextSearchParams = new URLSearchParams(searchParams.toString())

  setOrDelete(nextSearchParams, 'search', state.search, DEFAULT_ADMIN_EVENTS_TABLE_STATE.search)
  setOrDelete(nextSearchParams, 'category', state.mainCategorySlug, DEFAULT_ADMIN_EVENTS_TABLE_STATE.mainCategorySlug)
  setOrDelete(nextSearchParams, 'creator', state.creator, DEFAULT_ADMIN_EVENTS_TABLE_STATE.creator)
  setOrDelete(nextSearchParams, 'series', state.seriesSlug, DEFAULT_ADMIN_EVENTS_TABLE_STATE.seriesSlug)
  setOrDelete(nextSearchParams, 'attention', state.attention, DEFAULT_ADMIN_EVENTS_TABLE_STATE.attention)
  setOrDelete(nextSearchParams, 'sort', state.sortBy, DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortBy)
  setOrDelete(nextSearchParams, 'order', state.sortOrder, DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortOrder)
  setOrDelete(nextSearchParams, 'page', String(state.pageIndex + 1), '1')
  setOrDelete(nextSearchParams, 'pageSize', String(state.pageSize), String(DEFAULT_ADMIN_EVENTS_TABLE_STATE.pageSize))

  if (state.activeOnly) {
    nextSearchParams.set('active', '1')
  } else {
    nextSearchParams.delete('active')
  }

  return nextSearchParams
}
