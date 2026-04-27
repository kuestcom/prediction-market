import type { SupportedLocale } from '@/i18n/locales'
import { cacheTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'

type PlatformMainTagsResult = Awaited<ReturnType<typeof TagRepository.getMainTags>>

export async function loadPlatformMainTags(locale: SupportedLocale): Promise<PlatformMainTagsResult> {
  'use cache'
  cacheTag(cacheTags.mainTags(locale))

  const result = await TagRepository.getMainTags(locale)

  return {
    ...result,
    data: result.data ?? [],
    globalChilds: result.globalChilds ?? [],
  }
}
