'use client'

import { useExtracted } from 'next-intl'
import { DataTable } from '@/app/[locale]/admin/_components/DataTable'
import { useAdminUsersTable } from '@/app/[locale]/admin/_hooks/useAdminUsers'
import { useAdminUsersColumns } from './columns'

export default function AdminUsersTable() {
  const t = useExtracted()
  const columns = useAdminUsersColumns()
  const {
    users,
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
  } = useAdminUsersTable()

  function handleSortChangeWithTranslation(column: string | null, order: 'asc' | 'desc' | null) {
    if (column === null || order === null) {
      handleSortChange(null, null)
      return
    }

    const columnMapping: Record<string, string> = {
      user: 'username',
      email: 'email',
      created: 'created_at',
    }

    const dbFieldName = columnMapping[column] || column
    handleSortChange(dbFieldName, order)
  }

  return (
    <DataTable
      columns={columns}
      data={users}
      totalCount={totalCount}
      searchPlaceholder={t('Search users...')}
      enableSelection={true}
      enablePagination={true}
      enableColumnVisibility={true}
      isLoading={isLoading}
      error={error}
      onRetry={retry}
      emptyMessage={t('No users found')}
      emptyDescription={t('There are no users in the system yet.')}
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
  )
}
