import { connection } from 'next/server'
import { resolvePublicShellPrerenderMode } from '@/lib/public-shell-env'

export function shouldPrerenderPublicShell() {
  return resolvePublicShellPrerenderMode(process.env)
}

export async function deferPublicShellPrerenderIfNeeded() {
  if (shouldPrerenderPublicShell()) {
    return
  }

  await connection()
}
