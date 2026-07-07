function hasNonEmptyEnvValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function parseBooleanEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return null
}

function hasBuildSiteUrlEnv(env: NodeJS.ProcessEnv) {
  return hasNonEmptyEnvValue(env.SITE_URL)
    || hasNonEmptyEnvValue(env.VERCEL_PROJECT_PRODUCTION_URL)
}

function isProductionBuildPhase(env: NodeJS.ProcessEnv) {
  return env.NEXT_PHASE === 'phase-production-build'
}

export function hasPublicShellPrerenderEnv(env: NodeJS.ProcessEnv) {
  return hasBuildSiteUrlEnv(env)
    && hasNonEmptyEnvValue(env.POSTGRES_URL)
    && hasNonEmptyEnvValue(env.REOWN_APPKIT_PROJECT_ID)
}

export function resolvePublicShellPrerenderMode(env: NodeJS.ProcessEnv) {
  const explicitMode = parseBooleanEnv(env.BUILD_PRERENDER_PUBLIC_SHELL)
  if (explicitMode !== null) {
    return explicitMode
  }

  return isProductionBuildPhase(env) && hasPublicShellPrerenderEnv(env)
}
