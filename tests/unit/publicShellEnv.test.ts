import { describe, expect, it } from 'vitest'
import {
  hasPublicShellPrerenderEnv,
  resolvePublicShellPrerenderMode,
} from '@/lib/public-shell-env'

describe('public shell env detection', () => {
  it('enables prerendering when build-time public shell env is complete', () => {
    const env = {
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    } as NodeJS.ProcessEnv

    expect(hasPublicShellPrerenderEnv(env)).toBe(true)
    expect(resolvePublicShellPrerenderMode(env)).toBe(true)
  })

  it('accepts VERCEL_PROJECT_PRODUCTION_URL instead of SITE_URL', () => {
    const env = {
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      VERCEL_PROJECT_PRODUCTION_URL: 'markets.example.com',
    } as NodeJS.ProcessEnv

    expect(hasPublicShellPrerenderEnv(env)).toBe(true)
    expect(resolvePublicShellPrerenderMode(env)).toBe(true)
  })

  it('disables prerendering when the database is unavailable at build time', () => {
    const env = {
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    } as NodeJS.ProcessEnv

    expect(hasPublicShellPrerenderEnv(env)).toBe(false)
    expect(resolvePublicShellPrerenderMode(env)).toBe(false)
  })

  it('lets an explicit override force the build mode', () => {
    expect(resolvePublicShellPrerenderMode({
      KUEST_PRERENDER_PUBLIC_SHELL: 'false',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    } as NodeJS.ProcessEnv)).toBe(false)

    expect(resolvePublicShellPrerenderMode({
      KUEST_PRERENDER_PUBLIC_SHELL: 'true',
    } as NodeJS.ProcessEnv)).toBe(true)
  })
})
