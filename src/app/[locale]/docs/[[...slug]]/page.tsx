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
import { ViewOptions } from '@/components/docs/LLMPageActions'
import { withLocalePrefix } from '@/lib/locale-path'
import { source } from '@/lib/source'

function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    TradingFeeDisplay,
    AffiliateShareDisplay,
    PlatformShareDisplay,
    FeeCalculationExample,
    WebSocketPlayground,
    APIPage,
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
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <ViewOptions markdownUrl={markdownUrl} />
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

  const isOwnerGuideEnabled = JSON.parse(process.env.FORK_OWNER_GUIDE || 'false')
  if (params.slug?.[0] === 'owners' && !isOwnerGuideEnabled) {
    notFound()
  }
  if (params.slug?.[0] === 'api-reference' && params.slug.length === 1) {
    const introductionPage = source.getPage(['api-reference', 'introduction'])
    return {
      title: introductionPage?.data.title ?? 'API Reference',
      description: introductionPage?.data.description ?? 'API reference',
    }
  }

  const page = source.getPage(params.slug)
  if (!page) {
    notFound()
  }

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
