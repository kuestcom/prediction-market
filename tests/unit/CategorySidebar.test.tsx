import type { AnchorHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import CategorySidebar from '@/app/[locale]/(platform)/(home)/_components/CategorySidebar'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('next/image', () => ({
  default: function MockImage({ unoptimized: _unoptimized, ...props }: any) {
    return <img {...props} />
  },
}))

vi.mock('@/components/IntentPrefetchLink', () => ({
  default: function MockIntentPrefetchLink({
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
})
