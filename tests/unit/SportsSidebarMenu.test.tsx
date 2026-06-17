import type { AnchorHTMLAttributes, ReactNode } from 'react'
import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import SportsSidebarMenu from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'

vi.mock('next/image', () => ({
  default: function MockImage({ unoptimized: _unoptimized, ...props }: any) {
    return createElement('img', props)
  },
}))

vi.mock('@/components/AppLink', () => ({
  default: function MockAppLink({
    children,
    href,
    intentPrefetch: _intentPrefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    intentPrefetch?: boolean
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: { children: ReactNode }) => <>{children}</>,
  DrawerContent: () => null,
  DrawerTitle: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const entries: SportsMenuEntry[] = [
  {
    type: 'group',
    id: 'group-sports-ufc',
    label: 'UFC',
    href: '/sports/ufc/games',
    iconPath: '/icons/sports/ufc.svg',
    menuSlug: 'ufc',
    links: [
      {
        type: 'link',
        id: 'sports-ufc-all',
        label: 'All',
        href: '/sports/ufc/games',
        iconPath: '/icons/sports/ufc.svg',
        menuSlug: 'ufc',
      },
      {
        type: 'link',
        id: 'sports-powerslap',
        label: 'Power Slap',
        href: '/sports/powerslap/games',
        iconPath: '/icons/sports/powerslap.svg',
        menuSlug: 'powerslap',
      },
    ],
  },
]

describe('sportsSidebarMenu', () => {
  it('uses grouped parent rows as disclosure buttons and keeps All as the navigable link', () => {
    render(
      <SportsSidebarMenu
        entries={entries}
        vertical="sports"
        mode="all"
        activeTagSlug={null}
      />,
    )

    const groupButton = screen.getByRole('button', { name: 'UFC' })

    expect(screen.queryByRole('link', { name: 'UFC' })).not.toBeInTheDocument()
    expect(groupButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(groupButton)

    expect(groupButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/sports/ufc/games')
  })
})
