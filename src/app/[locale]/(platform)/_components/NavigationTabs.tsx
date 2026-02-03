'use cache'

import { Suspense } from 'react'
import NavigationTab from '@/app/[locale]/(platform)/_components/NavigationTab'
import { Skeleton } from '@/components/ui/skeleton'
import { TagRepository } from '@/lib/db/queries/tag'

export default async function NavigationTabs() {
  const { data, globalChilds = [] } = await TagRepository.getMainTags()

  const sharedChilds = globalChilds.map(child => ({ ...child }))
  const baseTags = (data ?? []).map(tag => ({
    ...tag,
    childs: (tag.childs ?? []).map(child => ({ ...child })),
  }))

  const childParentMap = Object.fromEntries(
    baseTags.flatMap(tag => tag.childs.map(child => [child.slug, tag.slug])),
  ) as Record<string, string>

  const tags = [
    { slug: 'trending', name: 'Trending', childs: sharedChilds },
    { slug: 'new', name: 'New', childs: sharedChilds.map(child => ({ ...child })) },
    ...baseTags,
  ]

  return (
    <nav className="sticky top-14 z-10 border-b bg-background">
      <div id="navigation-main-tags" className="container scrollbar-hide flex gap-6 overflow-x-auto text-sm font-medium">
        {tags.map((tag, index) => (
          <div key={tag.slug} className="flex items-center">
            <Suspense fallback={<Skeleton className="h-8 w-16 rounded-sm" />}>
              <NavigationTab tag={tag} childParentMap={childParentMap} />
            </Suspense>

            {index === 1 && <div className="mr-0 ml-6 h-4 w-px bg-border" />}
          </div>
        ))}
      </div>
    </nav>
  )
}
