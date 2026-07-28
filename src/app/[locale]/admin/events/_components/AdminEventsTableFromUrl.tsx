'use client'

import type { AdminEventsTableProps } from '@/app/[locale]/admin/events/_components/AdminEventsTable'
import type { AdminEventsTableStatePatch } from '@/app/[locale]/admin/events/_lib/admin-events-table-state'
import { usePathname, useSearchParams } from 'next/navigation'
import AdminEventsTable from '@/app/[locale]/admin/events/_components/AdminEventsTable'
import {
  parseAdminEventsTableState,
  updateAdminEventsSearchParams,
} from '@/app/[locale]/admin/events/_lib/admin-events-table-state'

type AdminEventsTableFromUrlProps = Omit<AdminEventsTableProps, 'tableState' | 'onTableStateChange'>

export default function AdminEventsTableFromUrl(props: AdminEventsTableFromUrlProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tableState = parseAdminEventsTableState(new URLSearchParams(searchParams.toString()))

  function handleTableStateChange(patch: AdminEventsTableStatePatch) {
    const nextSearchParams = updateAdminEventsSearchParams(
      new URLSearchParams(window.location.search),
      patch,
    )
    const query = nextSearchParams.toString()
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }

  return (
    <AdminEventsTable
      {...props}
      tableState={tableState}
      onTableStateChange={handleTableStateChange}
    />
  )
}
