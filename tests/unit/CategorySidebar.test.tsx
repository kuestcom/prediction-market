import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import CategorySidebar from '@/app/[locale]/(platform)/(home)/_components/CategorySidebar'
import { resolveCategorySidebarData } from '@/lib/category-sidebar-config'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('next/image', () => ({
  default: function MockImage({ unoptimized: _unoptimized, ...props }: any) {
    return createElement('img', props)
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: function MockLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

describe('categorySidebar', () => {
  it('renders configured sidebar items, counts, and dividers', () => {
    render(
      <CategorySidebar
        categorySlug="crypto"
        categoryTitle="Crypto"
        activeSubcategorySlug={null}
        onNavigate={() => {}}
        sidebarItems={[
          { type: 'link', slug: 'crypto', label: 'All', count: 3, icon: 'all-grid', isAll: true },
          { type: 'link', slug: '5M', label: '5 Min', count: 0, icon: 'five-minute' },
          { type: 'divider', key: 'assets' },
          { type: 'link', slug: 'bitcoin', label: 'Bitcoin', count: 1, icon: 'bitcoin' },
        ]}
        subcategories={[]}
      />,
    )

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('5 Min')).toBeInTheDocument()
    expect(screen.getByText('Bitcoin')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(1)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    const fiveMinuteLink = screen.getByRole('link', { name: /5 Min/ })
    const fiveMinuteIcon = fiveMinuteLink.querySelector('svg')
    expect(fiveMinuteIcon).not.toBeNull()
    expect(fiveMinuteIcon?.querySelector('[stroke="currentColor"]')).not.toBeNull()
    expect(fiveMinuteIcon?.parentElement).toHaveClass('text-foreground')
    expect(fiveMinuteLink.querySelector('img')).toBeNull()
  })

  it('uses custom href overrides for configured items', () => {
    render(
      <CategorySidebar
        categorySlug="finance"
        categoryTitle="Finance"
        activeSubcategorySlug={null}
        onNavigate={() => {}}
        sidebarItems={[
          { type: 'link', slug: 'finance', label: 'All', count: 3, icon: 'all-grid', isAll: true },
          {
            type: 'link',
            slug: 'earnings-calendar',
            label: 'Earnings Calendar',
            href: '/earnings',
            icon: 'earnings-calendar',
          },
        ]}
        subcategories={[]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Earnings Calendar' })).toHaveAttribute('href', '/earnings')
  })

  it('renders category icons inline and preserves the crypto asset logo section', () => {
    const { childs, sidebarItems } = resolveCategorySidebarData({
      categorySlug: 'crypto',
      categoryCount: 12,
      childs: [],
    })

    render(
      <CategorySidebar
        categorySlug="crypto"
        categoryTitle="Crypto"
        activeSubcategorySlug={null}
        onNavigate={() => {}}
        sidebarItems={sidebarItems}
        subcategories={childs}
      />,
    )

    const inlineIconLabels = [
      'All',
      '5 Min',
      '15 Min',
      '1 Hour',
      '4 Hours',
      'Daily',
      'Weekly',
      'Monthly',
      'Yearly',
      'Targets',
      'Pre-Market',
      'Institutions',
      'Industry',
      'Protocol Metrics',
    ]
    for (const label of inlineIconLabels) {
      const link = screen.getByRole('link', { name: new RegExp(`^${label}\\d+$`) })
      const icon = link.querySelector('svg')
      expect(icon).not.toBeNull()
      expect(icon?.querySelector('[stroke="currentColor"], [fill="currentColor"]')).not.toBeNull()
      expect(icon?.parentElement).toHaveClass('text-foreground')
    }

    const assetLabels = ['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'Dogecoin', 'BNB', 'MicroStrategy']
    for (const label of assetLabels) {
      const link = screen.getByRole('link', { name: new RegExp(label, 'i') })
      expect(link.querySelector('img')).not.toBeNull()
    }
  })
})
