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
  let signOutSucceeded = false

  try {
    await authClient.signOut()
    signOutSucceeded = true
  }
  catch {
    //
  }

  let clearSucceeded = false

  try {
    const response = await fetch('/auth/clear', {
      method: 'POST',
      credentials: 'include',
    })
    clearSucceeded = response.ok
  }
  catch {
    //
  }

  if (!signOutSucceeded && !clearSucceeded) {
    return false
  }

  useUser.setState(null)
  clearBrowserStorage()
  clearNonHttpOnlyCookies()

  window.location.href = localizePathname(redirectPath, currentPathname)
  return true
}
