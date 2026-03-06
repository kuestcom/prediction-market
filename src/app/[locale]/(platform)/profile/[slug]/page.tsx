'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { buildPublicProfileMetadata, PublicProfilePageContent } from '@/app/[locale]/(platform)/_lib/public-profile-page'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { normalizeAddress } from '@/lib/wallet'

function resolveProfileNamespaceSlug(slug: string) {
  if (slug.startsWith('@')) {
    return slug
  }

  return normalizeAddress(slug) ? slug : `@${slug}`
}

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({ params }: PageProps<'/[locale]/profile/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return buildPublicProfileMetadata(resolveProfileNamespaceSlug(slug))
}

export default async function ProfileSlugPage({ params }: PageProps<'/[locale]/profile/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return <PublicProfilePageContent slug={resolveProfileNamespaceSlug(slug)} />
}
