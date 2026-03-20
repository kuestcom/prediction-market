'use cache'

import type { MDXComponents } from 'mdx/types'
import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { AffiliateShareDisplay } from '@/app/[locale]/docs/_components/AffiliateShareDisplay'
import { APIPage } from '@/app/[locale]/docs/_components/APIPage'
import { DiscordLink } from '@/app/[locale]/docs/_components/DiscordLink'
import { FeeCalculationExample } from '@/app/[locale]/docs/_components/FeeCalculationExample'
import { ViewOptions } from '@/app/[locale]/docs/_components/LLMPageActions'
import { PlatformShareDisplay } from '@/app/[locale]/docs/_components/PlatformShareDisplay'
import { SiteName } from '@/app/[locale]/docs/_components/SiteName'
import { TradingFeeDisplay } from '@/app/[locale]/docs/_components/TradingFeeDisplay'
import { WebSocketPlayground } from '@/app/[locale]/docs/_components/WebSocketPlayground'
import { getEnglishDocsStaticParams, isLaunchGuideEnabled } from '@/lib/docs-static-params'
import { withLocalePrefix } from '@/lib/locale-path'
import { source } from '@/lib/source'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import { cn } from '@/lib/utils'

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

export async function generateStaticParams() {
  return getEnglishDocsStaticParams()
}

export async function generateMetadata(props: PageProps<'/[locale]/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  setRequestLocale(params.locale)
  const runtimeTheme = await loadRuntimeThemeState()
  const siteDocumentationTitle = `${runtimeTheme.site.name} Documentation`

  if (params.slug?.[0] === 'launch' && !isLaunchGuideEnabled()) {
    notFound()
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

export default async function Page(props: PageProps<'/[locale]/docs/[[...slug]]'>) {
  const params = await props.params
  setRequestLocale(params.locale)

  if (params.slug?.[0] === 'launch' && !isLaunchGuideEnabled()) {
    redirect('/docs/users')
  }

  const page = source.getPage(params.slug)
  if (!page) {
    redirect('/docs/users')
  }

  const localizedPageUrl = withLocalePrefix(page.url, params.locale as SupportedLocale)
  const markdownUrl = `${localizedPageUrl}.mdx`
  const MDX = page.data.body
  const useFullLayout = Boolean(page.data.full)

  return (
    <DocsPage
      toc={page.data.toc}
      full={useFullLayout}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <div className="border-b pb-4 lg:pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
          </div>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <ViewOptions markdownUrl={markdownUrl} />
            <DiscordLink className="h-8.5">
              Get Help
            </DiscordLink>
          </div>
        </div>
        <div className="-mt-4 flex flex-wrap items-center gap-2 lg:hidden">
          <ViewOptions markdownUrl={markdownUrl} />
          <DiscordLink className="h-8.5">
            Get Help
          </DiscordLink>
        </div>
      </div>
      <DocsBody className={cn({ 'max-w-none': useFullLayout })}>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}
