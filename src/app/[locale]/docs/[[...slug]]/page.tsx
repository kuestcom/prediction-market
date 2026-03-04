'use cache'

import type { MDXComponents } from 'mdx/types'
import type { Metadata, Route } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { AffiliateShareDisplay } from '@/app/[locale]/docs/_components/AffiliateShareDisplay'
import { FeeCalculationExample } from '@/app/[locale]/docs/_components/FeeCalculationExample'
import { PlatformShareDisplay } from '@/app/[locale]/docs/_components/PlatformShareDisplay'
import { TradingFeeDisplay } from '@/app/[locale]/docs/_components/TradingFeeDisplay'
import { WebSocketPlayground } from '@/app/[locale]/docs/_components/WebSocketPlayground'
import { APIPage } from '@/components/docs/APIPage'
import { DiscordLink } from '@/components/docs/DiscordLink'
import { ViewOptions } from '@/components/docs/LLMPageActions'
import { SiteName } from '@/components/docs/SiteName'
import { withLocalePrefix } from '@/lib/locale-path'
import { source } from '@/lib/source'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    APIPage,
    TradingFeeDisplay,
    AffiliateShareDisplay,
    PlatformShareDisplay,
    FeeCalculationExample,
    WebSocketPlayground,
    DiscordLink,
    SiteName,
    ...components,
  }
}

export default async function Page(props: PageProps<'/[locale]/docs/[[...slug]]'>) {
  const params = await props.params
  setRequestLocale(params.locale)
  const isApiReferencePage = params.slug?.[0] === 'api-reference'

  const isOwnerGuideEnabled = JSON.parse(process.env.FORK_OWNER_GUIDE || 'false')
  if (params.slug?.[0] === 'owners' && !isOwnerGuideEnabled) {
    redirect('/docs/users')
  }
  if (isApiReferencePage && params.slug?.length === 1) {
    const introductionRoute = `/${params.locale}/docs/api-reference/introduction` as Route
    redirect(introductionRoute)
  }

  const page = source.getPage(params.slug)
  if (!page) {
    redirect('/docs/users')
  }

  const localizedPageUrl = withLocalePrefix(page.url, params.locale as SupportedLocale)
  const markdownUrl = `${localizedPageUrl}.mdx`
  const MDX = page.data.body

  return (
    <DocsPage
      toc={page.data.toc}
      full={isApiReferencePage || page.data.full}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="-mt-4 flex flex-wrap items-center gap-2 border-b pb-4">
        <ViewOptions markdownUrl={markdownUrl} />
        <DiscordLink className="h-[34px]">
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
          Get Help
        </DiscordLink>
      </div>
      <DocsBody className={isApiReferencePage ? 'max-w-none' : undefined}>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: PageProps<'/[locale]/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  setRequestLocale(params.locale)
  const runtimeTheme = await loadRuntimeThemeState()
  const siteDocumentationTitle = `${runtimeTheme.site.name} Documentation`

  const isOwnerGuideEnabled = JSON.parse(process.env.FORK_OWNER_GUIDE || 'false')
  if (params.slug?.[0] === 'owners' && !isOwnerGuideEnabled) {
    notFound()
  }
  if (params.slug?.[0] === 'api-reference' && params.slug.length === 1) {
    const introductionPage = source.getPage(['api-reference', 'introduction'])
    return {
      title: {
        absolute: `${introductionPage?.data.title ?? 'API Reference'} | ${siteDocumentationTitle}`,
      },
      description: introductionPage?.data.description ?? 'API reference',
    }
  }

  const page = source.getPage(params.slug)
  if (!page) {
    notFound()
  }
  const pageTitle = page.data.title ?? 'Documentation'

  return {
    title: {
      absolute: `${pageTitle} | ${siteDocumentationTitle}`,
    },
    description: page.data.description,
  }
}
