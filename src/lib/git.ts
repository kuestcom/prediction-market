import { execSync } from 'node:child_process'

function toShortSha(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 7) : undefined
}

function parseSyncCommitUpstreamShortSha(commitMessage: string | undefined): string | undefined {
  const upstreamSha = commitMessage?.match(/^Upstream:\s*([0-9a-f]{7,64})\s*$/im)?.[1]
  return toShortSha(upstreamSha)
}

function readGitSyncCommitUpstreamShortSha(): string | undefined {
  try {
    const commitMessage = execSync('git log -1 --pretty=%B', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    return parseSyncCommitUpstreamShortSha(commitMessage)
  }
  catch {
    return undefined
  }
}

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
    parseSyncCommitUpstreamShortSha(process.env.VERCEL_GIT_COMMIT_MESSAGE)
    ?? readGitSyncCommitUpstreamShortSha()
    ?? toShortSha(process.env.COMMIT_SHA)
    ?? toShortSha(process.env.VERCEL_GIT_COMMIT_SHA)
    ?? readGitShortSha()
    ?? 'unknown'
  )
}
