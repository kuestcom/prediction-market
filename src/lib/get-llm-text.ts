import type { InferPageType } from 'fumadocs-core/source'
import type { source } from '@/lib/source'

export async function getLLMText(page: InferPageType<typeof source>) {
  return await page.data.getText('raw')
}
