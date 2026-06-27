import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  default: {
    execSync: mocks.execSync,
  },
  execSync: mocks.execSync,
}))

function mockGitCommands({
  commitMessage = 'Regular commit message',
  shortSha = '7654321',
}: {
  commitMessage?: string
  shortSha?: string
} = {}) {
  mocks.execSync.mockImplementation((command: string) => {
    if (command === 'git log -1 --pretty=%B') {
      return Buffer.from(commitMessage)
    }

    if (command === 'git rev-parse --short HEAD') {
      return Buffer.from(`${shortSha}\n`)
    }

    throw new Error(`Unexpected command: ${command}`)
  })
}

async function importGitWithBuildEnv({
  commitSha = '',
  vercelCommitMessage = '',
  vercelCommitSha = '',
}: {
  commitSha?: string
  vercelCommitMessage?: string
  vercelCommitSha?: string
} = {}) {
  vi.resetModules()
  vi.stubEnv('COMMIT_SHA', commitSha)
  vi.stubEnv('VERCEL_GIT_COMMIT_MESSAGE', vercelCommitMessage)
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', vercelCommitSha)

  return import('@/lib/git')
}

describe('resolveCommitSha', () => {
  beforeEach(() => {
    mocks.execSync.mockReset()
    vi.unstubAllEnvs()
  })

  it('uses the upstream SHA from a sync commit message', async () => {
    const { resolveCommitSha } = await importGitWithBuildEnv()

    expect(resolveCommitSha({
      VERCEL_GIT_COMMIT_MESSAGE: 'Sync fork\n\nUpstream: abcdef1234567890',
    })).toBe('abcdef1')
    expect(mocks.execSync).not.toHaveBeenCalled()
  })

  it('uses COMMIT_SHA from the supplied runtime environment', async () => {
    mockGitCommands()
    const { resolveCommitSha } = await importGitWithBuildEnv()

    expect(resolveCommitSha({ COMMIT_SHA: '1234567890abcdef' })).toBe('1234567')
  })

  it('keeps the build-time COMMIT_SHA as a runtime fallback', async () => {
    mockGitCommands()
    const { resolveCommitSha } = await importGitWithBuildEnv({ commitSha: 'fedcba9876543210' })

    expect(resolveCommitSha({})).toBe('fedcba9')
  })

  it('falls back to the local git short SHA', async () => {
    mockGitCommands({ shortSha: '7654321' })
    const { resolveCommitSha } = await importGitWithBuildEnv()

    expect(resolveCommitSha({})).toBe('7654321')
  })
})
