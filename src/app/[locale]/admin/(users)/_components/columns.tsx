'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDownIcon, MailIcon } from 'lucide-react'
import ProfileLink from '@/components/ProfileLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface AdminUserRow {
  id: string
  username: string
  email: string
  address: string
  proxy_wallet_address?: string | null
  created_label: string
  affiliate_code?: string | null
  referred_by_display?: string | null
  referred_by_profile_url?: string | null
  is_admin: boolean
  avatarUrl: string
  profileUrl: string
  created_at: string
  search_text: string
}

export const columns: ColumnDef<AdminUserRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
          || (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'username',
    id: 'user',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          User
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      const profileSlug = user.username || user.proxy_wallet_address || user.address
      return (
        <div className="min-w-44">
          <ProfileLink
            user={{
              address: user.address,
              proxy_wallet_address: user.proxy_wallet_address,
              image: user.avatarUrl,
              username: user.username,
            }}
            profileSlug={profileSlug}
            layout="inline"
            usernameAddon={user.is_admin ? <Badge variant="outline" className="text-xs">Admin</Badge> : null}
          />
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
        >
          Email
          <ArrowUpDownIcon className="ml-2 size-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="min-w-0 text-xs text-muted-foreground">
          {user.email
            ? (
                <a
                  href={`mailto:${user.email}`}
                  className="inline-flex touch-manipulation items-center gap-1 text-muted-foreground hover:text-primary"
                >
                  <MailIcon className="size-4 shrink-0" />
                  <span className="sr-only">
                    Email
                    {user.email}
                  </span>
                </a>
              )
            : (
                <span className="italic">hidden</span>
              )}
        </div>
      )
    },
  },
  {
    accessorKey: 'referred_by_display',
    id: 'referral',
    header: () => {
      return (
        <div className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase">
          Referral
        </div>
      )
    },
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="min-w-0">
          {user.referred_by_display
            ? (
                <a
                  href={user.referred_by_profile_url ?? '#'}
                  target={user.referred_by_profile_url ? '_blank' : undefined}
                  rel={user.referred_by_profile_url ? 'noreferrer' : undefined}
                  className={`
                    block max-w-15 touch-manipulation truncate text-xs font-medium text-foreground
                    hover:text-primary
                    sm:max-w-25
                  `}
                >
                  {user.referred_by_display}
                </a>
              )
            : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
        </div>
      )
    },
  },
  {
    accessorKey: 'created_at',
    id: 'created',
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-auto p-0 text-xs font-medium text-muted-foreground uppercase hover:text-foreground"
          >
            Created
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="text-right text-xs whitespace-nowrap text-muted-foreground">
          {user.created_label}
        </div>
      )
    },
  },
]
