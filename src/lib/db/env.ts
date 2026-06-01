export function hasDatabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  return typeof env.POSTGRES_URL === 'string' && env.POSTGRES_URL.trim().length > 0
}
