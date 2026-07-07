import { describe, expect, it } from 'vitest'
import {
  hasPublicShellPrerenderEnv,
  resolvePublicShellPrerenderMode,
} from '@/lib/public-shell-env'

describe('public shell env detection', () => {
  it('enables prerendering when build-time public shell env is complete', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      NEXT_PHASE: 'phase-production-build',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    }

    expect(hasPublicShellPrerenderEnv(env)).toBe(true)
    expect(resolvePublicShellPrerenderMode(env)).toBe(true)
  })

  it('accepts VERCEL_PROJECT_PRODUCTION_URL instead of SITE_URL', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      NEXT_PHASE: 'phase-production-build',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      VERCEL_PROJECT_PRODUCTION_URL: 'markets.example.com',
    }

    expect(hasPublicShellPrerenderEnv(env)).toBe(true)
    expect(resolvePublicShellPrerenderMode(env)).toBe(true)
  })

  it('disables prerendering when the database is unavailable at build time', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    }

    expect(hasPublicShellPrerenderEnv(env)).toBe(false)
    expect(resolvePublicShellPrerenderMode(env)).toBe(false)
  })

  it('does not infer prerendering from runtime-only env', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-server',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    }

    expect(hasPublicShellPrerenderEnv(env)).toBe(true)
    expect(resolvePublicShellPrerenderMode(env)).toBe(false)
  })

  it('lets an explicit override force the build mode', () => {
    expect(resolvePublicShellPrerenderMode({
      NODE_ENV: 'test',
      NEXT_PHASE: 'phase-production-build',
      BUILD_PRERENDER_PUBLIC_SHELL: 'false',
      POSTGRES_URL: 'postgres://user:pass@localhost:5432/app',
      REOWN_APPKIT_PROJECT_ID: 'project-id',
      SITE_URL: 'https://markets.example.com',
    })).toBe(false)

    expect(resolvePublicShellPrerenderMode({
      NODE_ENV: 'test',
      NEXT_PHASE: 'phase-production-server',
      BUILD_PRERENDER_PUBLIC_SHELL: 'true',
    })).toBe(true)
  })
})
