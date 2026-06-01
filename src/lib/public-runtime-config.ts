import resolveSiteUrl from '@/lib/site-url'

export interface PublicRuntimeConfig {
  reownAppKitProjectId: string
  siteUrl: string
}

function normalizePublicEnvValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : ''
}

export function getPublicRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PublicRuntimeConfig {
  return {
    reownAppKitProjectId: normalizePublicEnvValue(env.REOWN_APPKIT_PROJECT_ID),
    siteUrl: resolveSiteUrl(env),
  }
}
