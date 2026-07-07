import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

const CURRENT_TIME_MS = new Date('2026-05-26T10:00:00.000Z').getTime()
const NINE_HOURS_MS = 9 * 60 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const THIRTY_MINUTES_MS = 30 * 60 * 1000

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('next/image', () => ({
  default: function MockNextImage({ fill: _fill, ...props }: any) {
    return createElement('img', props)
  },
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: function MockTooltip({ children }: any) {
    return <div>{children}</div>
  },
  TooltipContent: function MockTooltipContent({ children, ...props }: any) {
    return <div {...props}>{children}</div>
  },
  TooltipTrigger: function MockTooltipTrigger({ children }: any) {
    return <>{children}</>
  },
}))

interface MockUpstreamCommit {
  committedAtMs: number | null
  sha: string
}

async function renderCopyVersion(
  upstreamCommit: MockUpstreamCommit | null,
  config: { commitSha?: string, isVercel?: string } = {},
) {
  vi.resetModules()
  mocks.useQuery.mockReturnValue({ data: upstreamCommit })

  const { default: CopyVersion } = await import('@/app/[locale]/admin/_components/CopyVersion')
  const { PublicRuntimeConfigContext } = await import('@/hooks/usePublicRuntimeConfig')
  const { defaultPublicRuntimeConfig } = await import('@/lib/public-runtime-config.shared')

  return render(
    <PublicRuntimeConfigContext
      value={{
        ...defaultPublicRuntimeConfig,
        commitSha: config.commitSha ?? 'abc1234',
        isVercel: config.isVercel ?? 'true',
        siteUrl: 'https://kuest.test',
      }}
    >
      <CopyVersion forkRepositoryUrl="https://github.com/kuest-fork/prediction-market-fork" />
    </PublicRuntimeConfigContext>,
  )
}

describe('copyVersion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(CURRENT_TIME_MS)
    mocks.useQuery.mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows fork sync guidance when the upstream commit differs past the sync grace period', async () => {
    await renderCopyVersion({
      committedAtMs: CURRENT_TIME_MS - NINE_HOURS_MS,
      sha: 'def5678',
    })

    expect(screen.getByRole('button', { name: 'Fork is behind upstream' })).toBeInTheDocument()
    expect(screen.getByText(/Your fork is not synced with the latest Kuest version/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sync fork' })).toHaveAttribute(
      'href',
      'https://github.com/kuest-fork/prediction-market-fork',
    )
    expect(screen.getByAltText('GitHub Sync fork button')).toHaveAttribute('src', '/images/sync/github-sync.jpg')
    expect(screen.getByText('abc1234')).toBeInTheDocument()
    expect(screen.getByText('def5678')).toBeInTheDocument()
  })

  it('keeps the warning hidden when the upstream commit starts with the current commit', async () => {
    await renderCopyVersion({
      committedAtMs: CURRENT_TIME_MS - TWO_HOURS_MS,
      sha: 'abc1234def5678abc9012def3456abc7890def12',
    })

    expect(screen.queryByRole('button', { name: 'Fork is behind upstream' })).not.toBeInTheDocument()
    expect(screen.queryByAltText('GitHub Sync fork button')).not.toBeInTheDocument()
    expect(screen.getByTitle('Copy version payload')).toHaveTextContent('v.abc1234')
  })

  it('keeps the warning hidden when the upstream mismatch is less than one hour old', async () => {
    await renderCopyVersion({
      committedAtMs: CURRENT_TIME_MS - THIRTY_MINUTES_MS,
      sha: 'def5678',
    })

    expect(screen.queryByRole('button', { name: 'Fork is behind upstream' })).not.toBeInTheDocument()
    expect(screen.queryByAltText('GitHub Sync fork button')).not.toBeInTheDocument()
    expect(screen.getByTitle('Copy version payload')).toHaveTextContent('v.abc1234')
  })

  it('keeps the upstream lookup disabled when the current commit is unknown', async () => {
    await renderCopyVersion(null, { commitSha: 'unknown' })

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
    }))
    expect(screen.getByTitle('Copy version payload')).toHaveTextContent('v.unknown')
  })

  it('treats GitHub upstream lookup failures as no warning', async () => {
    await renderCopyVersion(null)

    const queryOptions = mocks.useQuery.mock.calls[0][0]
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    await expect(queryOptions.queryFn({})).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/kuestcom/prediction-market/commits?per_page=1',
      expect.objectContaining({
        headers: {
          Accept: 'application/vnd.github+json',
        },
      }),
    )
  })
})
