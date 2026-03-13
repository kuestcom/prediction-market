import { authClient } from '@/lib/auth-client'
import { localizePathname } from '@/lib/locale-path'
import { clearBrowserStorage, clearNonHttpOnlyCookies } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface SignOutAndRedirectOptions {
  currentPathname: string
  redirectPath?: string
}

export async function signOutAndRedirect({
  currentPathname,
  redirectPath = '/',
}: SignOutAndRedirectOptions) {
  try {
    await authClient.signOut()
  }
  catch {
    //
  }

  try {
    await fetch('/auth/clear', {
      method: 'POST',
      credentials: 'include',
    })
  }
  catch {
    //
  }

  useUser.setState(null)
  clearBrowserStorage()
  clearNonHttpOnlyCookies()

  window.location.href = localizePathname(redirectPath, currentPathname)
}
