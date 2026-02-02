import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { BookOpenIcon, CodeIcon, GitForkIcon, HomeIcon } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import { source } from '@/lib/source'
import { svgLogo } from '@/lib/utils'

export default async function Layout({ params, children }: LayoutProps<'/[locale]/docs'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <RootProvider
      search={{
        options: {
          api: '/docs/api/search',
        },
      }}
    >
      <DocsLayout
        nav={{
          title: (
            <>
              <div
                className="size-6"
                dangerouslySetInnerHTML={{
                  __html: svgLogo(),
                }}
              />
              <span className="font-medium">
                {`${process.env.NEXT_PUBLIC_SITE_NAME} Docs`}
              </span>
            </>
          ),
          transparentMode: 'top',
        }}
        sidebar={{
          tabs: [
            {
              title: 'User Guide',
              description: 'How to use the platform',
              url: '/docs/users',
              icon: <BookOpenIcon className="size-4" />,
            },
            {
              title: 'Developer Guide',
              description: 'API reference and details',
              url: '/docs/developers',
              icon: <CodeIcon className="size-4" />,
            },
            ...(JSON.parse(process.env.NEXT_PUBLIC_FORK_OWNER_GUIDE || 'false')
              ? [
                  {
                    title: 'Fork Owner Guide',
                    description: 'Create your own platform',
                    url: '/docs/owners',
                    icon: <GitForkIcon className="size-4" />,
                  },
                ]
              : []),
          ],
        }}
        tree={source.pageTree}
        themeSwitch={{
          mode: 'light-dark-system',
        }}
        links={[
          {
            type: 'main',
            url: '/',
            text: process.env.NEXT_PUBLIC_SITE_NAME,
            icon: <HomeIcon />,
          },
          ...(process.env.NEXT_PUBLIC_DISCORD_LINK
            ? [
                {
                  type: 'main' as const,
                  url: process.env.NEXT_PUBLIC_DISCORD_LINK,
                  text: 'Discord Community',
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="currentColor"
                        d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0a13 13 0 0 0-.617-1.25a.08.08 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.1.1 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.08.08 0 0 0 .084-.028a14 14 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13 13 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10 10 0 0 0 .372-.292a.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01q.181.149.373.292a.077.077 0 0 1-.006.127a12.3 12.3 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028a19.8 19.8 0 0 0 6.002-3.03a.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418"
                      />
                    </svg>
                  ),
                },
              ]
            : []),
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
