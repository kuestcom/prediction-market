import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import PlatformFooter, { PlatformLayoutFooter } from '@/app/[locale]/(platform)/(home)/_components/PlatformFooter'
import { createDefaultThemeSiteIdentity } from '@/lib/theme-site-identity'

const mocks = vi.hoisted(() => ({
  pathname: '/',
  site: null as any,
  tags: [] as any[],
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useExtracted: () => {
    function translate(value: string, values?: Record<string, string>) {
      return values ? value.replace('{category}', values.category ?? '') : value
    }
    translate.rich = (value: string) => value.replace(/<\/?terms>/g, '')
    return translate
  },
}))

vi.mock('@/app/[locale]/(platform)/_providers/PlatformNavigationProvider', () => ({
  usePlatformNavigationData: () => ({ tags: mocks.tags, childParentMap: {} }),
}))

vi.mock('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => mocks.site,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: ReactNode, href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
  usePathname: () => mocks.pathname,
}))

vi.mock('@/components/SiteLogoIcon', () => ({
  default: () => <span data-testid="site-logo" />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}))

describe('platformFooter', () => {
  beforeEach(() => {
    mocks.pathname = '/'
    mocks.site = createDefaultThemeSiteIdentity()
    mocks.tags = [
      { slug: 'trending', name: 'Trending', childs: [] },
      { slug: 'new', name: 'New', childs: [] },
      {
        slug: 'weather',
        name: 'Weather',
        childs: [{ slug: 'temperature', name: 'Temperature', count: 2 }],
      },
      { slug: 'empty', name: 'Empty', childs: [] },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ locales: ['en'] }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the default main-category footer when a category has no popular markets', () => {
    render(
      <PlatformFooter
        categorySlug="weather"
        categoryPopularEvents={[]}
        categoryNewEvents={[]}
      />,
    )

    expect(screen.getByText('Markets by category and topics')).toBeInTheDocument()
    expect(screen.getByText('Weather')).toBeInTheDocument()
    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.queryByText('Related topics')).not.toBeInTheDocument()
  })

  it('shows category topics plus popular and new markets when category data is available', () => {
    render(
      <PlatformFooter
        categorySlug="weather"
        categoryPopularEvents={[{ id: 'popular', slug: 'popular-weather', title: 'Popular weather market' } as any]}
        categoryNewEvents={[{ id: 'new', slug: 'new-weather', title: 'New weather market' } as any]}
      />,
    )

    expect(screen.getByText('Related topics')).toBeInTheDocument()
    expect(screen.getByText('Popular Weather markets')).toBeInTheDocument()
    expect(screen.getByText('New Weather markets')).toBeInTheDocument()
    expect(screen.getByText('Popular weather market')).toBeInTheDocument()
    expect(screen.getByText('New weather market')).toBeInTheDocument()
    expect(screen.queryByText('Markets by category and topics')).not.toBeInTheDocument()
  })

  it('expands the standard footer from 15 categories to all main categories', () => {
    mocks.tags = [
      { slug: 'trending', name: 'Trending', childs: [] },
      ...Array.from({ length: 16 }, (_, index) => ({
        slug: `category-${index + 1}`,
        name: `Category ${index + 1}`,
        childs: [],
      })),
    ]

    render(
      <PlatformFooter
        categorySlug={null}
        categoryPopularEvents={[]}
        categoryNewEvents={[]}
      />,
    )

    expect(screen.queryByText('Category 16')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View more/ }))
    expect(screen.getByText('Category 16')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View less/ })).toBeInTheDocument()
  })

  it('renders in public platform routes outside the dynamic home pages', () => {
    mocks.pathname = '/event/public-market'

    render(<PlatformLayoutFooter />)

    expect(screen.getByText('Markets by category and topics')).toBeInTheDocument()
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })

  it('lets the home page render its specialized footer without a duplicate from the platform layout', () => {
    render(<PlatformLayoutFooter />)

    expect(screen.queryByText('Markets by category and topics')).not.toBeInTheDocument()
  })

  it('renders only social networks configured in the site identity', () => {
    mocks.site = {
      ...createDefaultThemeSiteIdentity(),
      twitterLink: 'https://x.com/kuest',
      instagramLink: 'https://instagram.com/kuest',
    }

    render(
      <PlatformFooter
        categorySlug={null}
        categoryPopularEvents={[]}
        categoryNewEvents={[]}
      />,
    )

    expect(screen.getAllByRole('link', { name: 'X (Twitter)' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Instagram' })).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Discord' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Contact us' })).not.toBeInTheDocument()
  })
})
