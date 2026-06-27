import type { PublicRuntimeConfig } from '@/lib/public-runtime-config.shared'
import { resolveCommitSha } from '@/lib/git'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import resolveSiteUrl from '@/lib/site-url'

export type { PublicRuntimeConfig } from '@/lib/public-runtime-config.shared'

export function getPublicRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PublicRuntimeConfig {
  return {
    ...resolvePublicRuntimeEnv(env),
    commitSha: resolveCommitSha(env),
    siteUrl: resolveSiteUrl(env),
  }
}

export function serializePublicRuntimeConfig(config: PublicRuntimeConfig) {
  return JSON.stringify(config).replace(/</g, '\\u003c')
}
