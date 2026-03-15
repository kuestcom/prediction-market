import { cacheTag } from 'next/cache'

export function applyCacheTag(tag: string) {
  try {
    cacheTag(tag)
  }
  catch {}
}
