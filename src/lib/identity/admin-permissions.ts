import type { IdentityAdminPermission } from './types'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { identity_admin_permissions } from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import 'server-only'

const ADMIN_DEFAULT_PERMISSIONS = new Set<IdentityAdminPermission>([
  'identity_configure',
  'identity_manage_permissions',
])

export async function getIdentityAdminPermissions(user: { id: string, is_admin?: boolean | null }) {
  if (!user.is_admin) {
    return new Set<IdentityAdminPermission>()
  }

  const rows = await db
    .select({ permission: identity_admin_permissions.permission })
    .from(identity_admin_permissions)
    .where(and(
      eq(identity_admin_permissions.user_id, user.id),
      or(
        isNull(identity_admin_permissions.expires_at),
        gt(identity_admin_permissions.expires_at, new Date()),
      ),
    ))

  return new Set<IdentityAdminPermission>([
    ...ADMIN_DEFAULT_PERMISSIONS,
    ...rows.map(row => row.permission as IdentityAdminPermission),
  ])
}

export async function hasIdentityAdminPermission(
  user: { id: string, is_admin?: boolean | null },
  permission: IdentityAdminPermission,
) {
  return (await getIdentityAdminPermissions(user)).has(permission)
}

export async function assertIdentityAdminPermission(
  user: { id: string, is_admin?: boolean | null } | null | undefined,
  permission: IdentityAdminPermission,
) {
  if (!user || !(await hasIdentityAdminPermission(user, permission))) {
    throw new Error('IDENTITY_ADMIN_FORBIDDEN')
  }
}
