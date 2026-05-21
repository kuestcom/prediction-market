import { execSync } from 'node:child_process'

function readGitShortSha(): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  }
  catch {
    return undefined
  }
}

export function resolveCommitSha() {
  return (
    process.env.COMMIT_SHA?.slice(0, 7)
    ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
    ?? readGitShortSha()
    ?? 'unknown'
  )
}
