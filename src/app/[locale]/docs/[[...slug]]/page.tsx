import type { MDXComponents } from 'mdx/types'
import type { Metadata } from 'next'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { AffiliateShareDisplay } from '@/app/[locale]/docs/_components/AffiliateShareDisplay'
import { FeeCalculationExample } from '@/app/[locale]/docs/_components/FeeCalculationExample'
import { PlatformShareDisplay } from '@/app/[locale]/docs/_components/PlatformShareDisplay'
import { TradingFeeDisplay } from '@/app/[locale]/docs/_components/TradingFeeDisplay'
import { source } from '@/lib/source'

function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    TradingFeeDisplay,
    AffiliateShareDisplay,
    PlatformShareDisplay,
    FeeCalculationExample,
    ...components,
  }
}

export default async function Page(props: PageProps<'/[locale]/docs/[[...slug]]'>) {
  const params = await props.params
  setRequestLocale(params.locale)

  const isOwnerGuideEnabled = JSON.parse(process.env.NEXT_PUBLIC_FORK_OWNER_GUIDE || 'false')
  if (params.slug?.[0] === 'owners' && !isOwnerGuideEnabled) {
    redirect('/docs/users')
  }

  const page = source.getPage(params.slug)
  if (!page) {
    redirect('/docs/users')
  }

  const MDX = page.data.body

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
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

  const isOwnerGuideEnabled = JSON.parse(process.env.NEXT_PUBLIC_FORK_OWNER_GUIDE || 'false')
  if (params.slug?.[0] === 'owners' && !isOwnerGuideEnabled) {
    notFound()
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
