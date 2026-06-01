import { connection } from 'next/server'

const SHOULD_PRERENDER_PUBLIC_SHELL = process.env.BUILD_PRERENDER_PUBLIC_SHELL === 'true'

export function shouldPrerenderPublicShell() {
  return SHOULD_PRERENDER_PUBLIC_SHELL
}

export async function deferPublicShellPrerenderIfNeeded() {
  if (SHOULD_PRERENDER_PUBLIC_SHELL) {
    return
  }

  await connection()
}
